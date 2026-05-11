from datetime import date, datetime, timezone, timedelta

from app.database import SessionLocal
from app.models.setting import AppSetting
from app.models.server import Server
from app.services.telegram_notify import _try_send, _save_to_queue


def _get_settings(keys: list[str]) -> dict:
    db = SessionLocal()
    try:
        rows = db.query(AppSetting).filter(AppSetting.key.in_(keys)).all()
        return {row.key: row.value for row in rows}
    except:
        return {}
    finally:
        db.close()


def _days_remaining(next_payment: date | None) -> int | None:
    if not next_payment:
        return None
    diff = (next_payment - date.today()).days
    return diff


def _severity_icon(days: int | None) -> str:
    if days is None:
        return ""
    if days <= 1:
        return "\U0001f6d1"  # 🆑 red
    if days <= 7:
        return "\u26a0\ufe0f"  # ⚠️ orange
    if days <= 14:
        return "\U0001f4a4"  # 💤 yellow
    return "\u2705"  # ✅ green


def _purpose_emoji(purpose: str) -> str:
    mapping = {
        "PANEL": "\U0001f5a5\ufe0f",
        "NODE": "\u2694\ufe0f",
        "SERVICES": "\u2699\ufe0f",
    }
    return mapping.get(purpose, "\U0001f4e1")


def _generate_report(template: str) -> str:
    db = SessionLocal()
    try:
        servers = db.query(Server).order_by(Server.purpose, Server.hosting).all()
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
    server_count = 0
    for purpose in order:
        if purpose not in groups:
            continue
        grp_servers = groups[purpose]
        label = purpose  # e.g. PANEL, NODE, SERVICES
        emoji = _purpose_emoji(purpose)
        all_lines.append(f"\n{emoji} {label}")
        for i, s in enumerate(grp_servers, 1):
            cost_val = float(s.cost) if s.cost else 0
            total_cost += cost_val
            server_count += 1
            days = _days_remaining(s.next_payment)
            days_str = f"{days} \u0434\u043d." if days is not None else "—"
            icon = _severity_icon(days)
            currency = s.currency or ""
            cost_str = f"{cost_val:.2f}{currency}" if cost_val else "—"
            prefix = "\u2514" if i == len(grp_servers) else "\u251c"
            name = s.purpose or "SERVER"
            country = s.country or ""
            hosting = s.hosting or ""
            server_entry = f"{prefix} {name} [{country}] {hosting} \u2014 {cost_str} \u2014 {days_str} {icon}"
            all_lines.append(server_entry)

    total_str = f"{total_cost:.2f}"
    footer = f"\n---\n\U0001f4b0 \u0418\u0442\u043e\u0433\u043e: {total_str}"

    all_lines.append(footer)

    default_report = "\n".join([
        f"\U0001f4c5 \u0421\u0442\u0430\u0442\u0443\u0441 \u0430\u0440\u0435\u043d\u0434\u044b: {today_str}"
    ] + all_lines)

    if template:
        groups_text = "\n".join(all_lines)
        report = template.replace("{date}", today_str).replace("{groups}", groups_text).replace("{total}", total_str)
    else:
        report = default_report

    return report


def send_daily_billing_report():
    settings = _get_settings([
        "telegram_bot_token", "socks5_proxy",
        "billing_notify_chat_id", "billing_notify_topic_id",
        "billing_notify_enabled", "billing_notify_template",
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
