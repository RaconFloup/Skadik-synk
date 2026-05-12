from datetime import date

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.setting import AppSetting
from app.models.server import Server
from app.models.hosting import Hosting
from app.services.telegram_notify import _try_send, _save_to_queue
from app.services.settings_utils import get_settings

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
    return get_settings(keys)


def _country_ru(raw: str) -> str:
    code = raw.split(" ")[0] if raw else ""
    return COUNTRY_RU.get(code, raw)


def _load_purpose_labels(db: Session) -> dict[str, str]:
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "purposes").first()
        if row and row.value:
            import json
            items = json.loads(row.value)
            return {p["value"]: p["label"] for p in items if isinstance(p, dict)}
    except Exception:
        pass
    return {}


def _load_hosting_urls(db: Session) -> dict[str, str]:
    try:
        hostings = db.query(Hosting).all()
        return {h.name: (h.url or "") for h in hostings}
    except Exception:
        return {}


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


def _load_exchange_rates(db: Session) -> dict[str, float]:
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "exchange_rates").first()
        if row and row.value:
            import json
            return json.loads(row.value)
    except Exception:
        pass
    return {}


def _load_main_currency(db: Session) -> str:
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "main_currency").first()
        if row and row.value:
            return row.value
    except Exception:
        pass
    return "RUB"


def _convert_to_main(cost_val: float, currency: str, rates: dict, main_currency: str) -> float:
    if not cost_val or not currency or currency == main_currency:
        return cost_val
    rate_from = rates.get(currency)
    rate_to = rates.get(main_currency)
    if rate_from and rate_to:
        return cost_val * rate_to / rate_from
    return cost_val


def _generate_report(template: str) -> str:
    db = SessionLocal()
    try:
        purpose_labels = _load_purpose_labels(db)
        hosting_urls = _load_hosting_urls(db)
        nickname_row = db.query(AppSetting).filter(AppSetting.key == "billing_notify_nickname").first()
        nickname = nickname_row.value if nickname_row and nickname_row.value else ""
        rates = _load_exchange_rates(db)
        main_currency = _load_main_currency(db)
    finally:
        db.close()

    today = date.today()
    current_month_key = f"{today.year}-{today.month:02d}"
    today_str = today.strftime("%d.%m.%Y")

    db = SessionLocal()
    try:
        servers = db.query(Server).filter(
            Server.status == "active",
        ).order_by(Server.purpose, Server.hosting).all()
    finally:
        db.close()

    def in_current_month(s: Server) -> bool:
        np = s.next_payment
        lp = s.last_paid_at
        if np and np.strftime("%Y-%m") == current_month_key:
            return True
        if lp and lp.strftime("%Y-%m") == current_month_key:
            return True
        return False

    servers = [s for s in servers if in_current_month(s)]

    groups: dict[str, list[Server]] = {}
    order = ["PANEL", "NODE", "SERVICES"]
    for s in servers:
        g = s.purpose or "OTHER"
        if g not in groups:
            groups[g] = []
        groups[g].append(s)

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
            cur = s.currency or ""
            costs = s.costs or {}
            main_val = costs.get(main_currency) or _convert_to_main(cost_val, cur, rates, main_currency)
            total_cost += main_val
            days = _days_remaining(s.next_payment)
            days_str = f"{days} дн." if days is not None else "\u2014"
            icon = _icon(bool(s.not_renewing), days)
            is_paid = bool(s.last_paid_at) and s.last_paid_at.strftime("%Y-%m") == current_month_key
            paid_badge = "\u2705 \u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e" if is_paid else ""
            main_sym = CURRENCY_SYMBOLS.get(main_currency, main_currency)
            main_cost_str = f"{main_val:.2f}{main_sym}"
            if cur and cur != main_currency and cost_val:
                orig_sym = CURRENCY_SYMBOLS.get(cur, cur)
                main_cost_str += f" ({orig_sym}{cost_val:.2f})"
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
            line2 = f"{pad} {main_cost_str} \u2014 {paid_badge} {days_str} {icon}" if is_paid else f"{pad} {main_cost_str} \u2014 {days_str} {icon}"
            all_lines.append(line1)
            all_lines.append(line2)
            if days is not None and days <= 1:
                has_urgent = True

    total_sym = CURRENCY_SYMBOLS.get(main_currency, main_currency)
    total_str = f"{total_cost:.2f}{total_sym}"

    if not template:
        template = DEFAULT_REPORT_TEMPLATE

    groups_text = "\n".join(all_lines)
    report = template.replace("{date}", today_str).replace("{groups}", groups_text).replace("{total}", total_str)

    if has_urgent and nickname:
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
