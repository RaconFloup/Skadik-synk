from datetime import date

from app.database import SessionLocal
from app.models.setting import AppSetting
from app.models.server import Server
from app.models.hosting import Hosting
from app.services.telegram_notify import _try_send, _save_to_queue

COUNTRY_RU: dict[str, str] = {
    "ru": "\U0001F1F7\U0001F1FA Россия",
    "us": "\U0001F1FA\U0001F1F8 США",
    "de": "\U0001F1E9\U0001F1EA Германия",
    "nl": "\U0001F1F3\U0001F1F1 Нидерланды",
    "fr": "\U0001F1EB\U0001F1F7 Франция",
    "gb": "\U0001F1EC\U0001F1E7 Великобритания",
    "pl": "\U0001F1F5\U0001F1F1 Польша",
    "ua": "\U0001F1FA\U0001F1E6 Украина",
    "lt": "\U0001F1F1\U0001F1F9 Литва",
    "lv": "\U0001F1F1\U0001F1FB Латвия",
    "ee": "\U0001F1EA\U0001F1EA Эстония",
    "fi": "\U0001F1EB\U0001F1EE Финляндия",
    "se": "\U0001F1F8\U0001F1EA Швеция",
    "no": "\U0001F1F3\U0001F1F4 Норвегия",
    "dk": "\U0001F1E9\U0001F1F0 Дания",
    "cz": "\U0001F1E8\U0001F1FF Чехия",
    "sk": "\U0001F1F8\U0001F1F0 Словакия",
    "hu": "\U0001F1ED\U0001F1FA Венгрия",
    "ro": "\U0001F1F7\U0001F1F4 Румыния",
    "bg": "\U0001F1E7\U0001F1EC Болгария",
    "gr": "\U0001F1EC\U0001F1F7 Греция",
    "it": "\U0001F1EE\U0001F1F9 Италия",
    "es": "\U0001F1EA\U0001F1F8 Испания",
    "pt": "\U0001F1F5\U0001F1F9 Португалия",
    "at": "\U0001F1E6\U0001F1F9 Австрия",
    "ch": "\U0001F1E8\U0001F1ED Швейцария",
    "be": "\U0001F1E7\U0001F1EA Бельгия",
    "ie": "\U0001F1EE\U0001F1EA Ирландия",
    "sg": "\U0001F1F8\U0001F1EC Сингапур",
    "jp": "\U0001F1EF\U0001F1F5 Япония",
    "kr": "\U0001F1F0\U0001F1F7 Южная Корея",
    "in": "\U0001F1EE\U0001F1F3 Индия",
    "au": "\U0001F1E6\U0001F1FA Австралия",
    "ca": "\U0001F1E8\U0001F1E6 Канада",
    "br": "\U0001F1E7\U0001F1F7 Бразилия",
    "za": "\U0001F1FF\U0001F1E6 ЮАР",
}

CURRENCY_SYMBOLS = {"RUB": "\u20bd", "USD": "$", "EUR": "\u20ac"}


def _get_settings(keys: list[str]) -> dict:
    db = SessionLocal()
    try:
        rows = db.query(AppSetting).filter(AppSetting.key.in_(keys)).all()
        return {row.key: row.value for row in rows}
    except:
        return {}
    finally:
        db.close()


def _country_ru(raw: str) -> str:
    code = raw.split(" ")[0] if raw else ""
    return COUNTRY_RU.get(code, raw)


def _load_purpose_labels() -> dict[str, str]:
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "purposes").first()
        if row and row.value:
            import json
            items = json.loads(row.value)
            return {p["value"]: p["label"] for p in items if isinstance(p, dict)}
    except:
        pass
    finally:
        db.close()
    return {}


def _load_hosting_urls() -> dict[str, str]:
    db = SessionLocal()
    try:
        hostings = db.query(Hosting).all()
        return {h.name: (h.url or "") for h in hostings}
    except:
        return {}
    finally:
        db.close()


def _days_remaining(next_payment: date | None) -> int | None:
    if not next_payment:
        return None
    return (next_payment - date.today()).days


def _icon(not_renewing: bool, days: int | None) -> str:
    if not_renewing:
        return "\U0001f4a4"
    if days is None:
        return ""
    if days <= 1:
        return "\U0001f6d1"
    if days <= 7:
        return "\u26a0\ufe0f"
    return "\u2705"


def _purpose_emoji(purpose: str) -> str:
    mapping = {
        "PANEL": "\U0001f5a5\ufe0f",
        "NODE": "\u2694\ufe0f",
        "SERVICES": "\u2699\ufe0f",
    }
    return mapping.get(purpose, "\U0001f4e1")


def _fmt_cost(cost_val: float, currency: str) -> str:
    if not cost_val:
        return "\u2014"
    sym = CURRENCY_SYMBOLS.get(currency, currency)
    return f"{cost_val:.2f}{sym}"


DEFAULT_REPORT_TEMPLATE = (
    "\U0001f4c5 Статус аренды: {date}\n"
    "{groups}\n"
    "---\n"
    "\U0001f4b0 Итого: {total}"
)


def _generate_report(template: str) -> str:
    db = SessionLocal()
    try:
        servers = db.query(Server).order_by(Server.purpose, Server.hosting).all()
        purpose_labels = _load_purpose_labels()
        hosting_urls = _load_hosting_urls()
    finally:
        db.close()

    groups: dict[str, list[Server]] = {}
    order = ["PANEL", "NODE", "SERVICES"]
    for s in servers:
        g = s.purpose or "OTHER"
        if g not in groups:
            groups[g] = []
        groups[g].append(s)

    today_str = date.today().strftime("%d.%m.%Y")

    all_lines: list[str] = []
    total_cost = 0.0
    has_urgent = False
    for purpose in order:
        if purpose not in groups:
            continue
        grp_servers = groups[purpose]
        label = purpose_labels.get(purpose, purpose)
        emoji = _purpose_emoji(purpose)
        all_lines.append(f"\n{emoji} {label}")
        for i, s in enumerate(grp_servers, 1):
            cost_val = float(s.cost) if s.cost else 0
            total_cost += cost_val
            days = _days_remaining(s.next_payment)
            days_str = f"{days} дн." if days is not None else "\u2014"
            icon = _icon(bool(s.not_renewing), days)
            cost_str = _fmt_cost(cost_val, s.currency or "")
            prefix_char = "\u2514" if i == len(grp_servers) else "\u251c"
            pad = " " * len(prefix_char)
            country = _country_ru(s.country or "")
            hosting_name = s.hosting or ""
            hosting_url = hosting_urls.get(hosting_name, "")
            if hosting_url:
                hosting_display = f'<a href="{hosting_url}">{hosting_name}</a>'
            else:
                hosting_display = hosting_name
            line1 = f"{prefix_char} {label} [{country}] {hosting_display}"
            line2 = f"{pad} {cost_str} \u2014 {days_str} {icon}"
            all_lines.append(line1)
            all_lines.append(line2)
            if days is not None and days <= 1:
                has_urgent = True

    total_sym = "₽"
    total_str = f"{total_cost:.2f}{total_sym}"

    if not template:
        template = DEFAULT_REPORT_TEMPLATE

    groups_text = "\n".join(all_lines)
    report = template.replace("{date}", today_str).replace("{groups}", groups_text).replace("{total}", total_str)

    if has_urgent:
        nickname = _get_settings(["billing_notify_nickname"]).get("billing_notify_nickname", "")
        if nickname:
            report += f"\n\n\U0001f464 Оплатить: @{nickname}"

    return report


def send_daily_billing_report():
    settings = _get_settings([
        "telegram_bot_token", "socks5_proxy",
        "billing_notify_chat_id", "billing_notify_topic_id",
        "billing_notify_enabled", "billing_notify_template",
        "billing_notify_nickname",
    ])
    token = settings.get("telegram_bot_token", "")
    chat_id = settings.get("billing_notify_chat_id", "")
    topic_id = settings.get("billing_notify_topic_id", "")
    enabled = settings.get("billing_notify_enabled", "0")
    template = settings.get("billing_notify_template", "")
    proxy = settings.get("socks5_proxy", "") or None

    if not token or not chat_id or enabled != "1":
        return

    report = _generate_report(template)

    err = _try_send(token, chat_id, report, topic_id or None, proxy)
    if err is not None:
        _save_to_queue(chat_id, topic_id or "", report, err)
