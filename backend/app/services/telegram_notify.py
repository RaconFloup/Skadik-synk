import httpx

from app.database import SessionLocal
from app.models.setting import AppSetting


def _get_notify_settings() -> dict:
    db = SessionLocal()
    try:
        keys = [
            "telegram_bot_token", "socks5_proxy",
            "uptime_notify_chat_id", "uptime_notify_topic_id",
            "uptime_notify_on_down", "uptime_notify_on_up",
            "uptime_notify_down_template", "uptime_notify_up_template",
        ]
        rows = db.query(AppSetting).filter(AppSetting.key.in_(keys)).all()
        return {row.key: row.value for row in rows}
    except:
        return {}
    finally:
        db.close()


def send_uptime_notification(monitor_name: str, is_up: bool, error: str | None = None):
    settings = _get_notify_settings()
    token = settings.get("telegram_bot_token", "")
    chat_id = settings.get("uptime_notify_chat_id", "")
    topic_id = settings.get("uptime_notify_topic_id", "")
    notify_on_down = settings.get("uptime_notify_on_down", "1")
    notify_on_up = settings.get("uptime_notify_on_up", "1")
    down_template = settings.get("uptime_notify_down_template", "")
    up_template = settings.get("uptime_notify_up_template", "")
    proxy = settings.get("socks5_proxy", "") or None

    if not token or not chat_id:
        return

    if is_up and notify_on_up != "1":
        return
    if not is_up and notify_on_down != "1":
        return

    if is_up:
        if up_template:
            text = up_template.replace("{name}", monitor_name)
        else:
            text = f"\u2705 <b>{monitor_name}</b>\n\u041c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433 \u0430\u043f\u0442\u0430\u0439\u043c\u0430: \u0441\u0435\u0440\u0432\u0435\u0440 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d"
    else:
        err_text = error or "\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0435 \u043f\u043e\u0442\u0435\u0440\u044f\u043d\u043e"
        if down_template:
            text = down_template.replace("{name}", monitor_name).replace("{error}", err_text)
        else:
            text = f"\u274c <b>{monitor_name}</b>\n\u041c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433 \u0430\u043f\u0442\u0430\u0439\u043c\u0430: \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d\n{err_text}"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }
    if topic_id:
        payload["message_thread_id"] = topic_id

    try:
        kwargs = {"timeout": 10.0}
        if proxy:
            kwargs["proxies"] = {"all://": proxy}
        with httpx.Client(**kwargs) as client:
            client.post(url, json=payload)
    except Exception as e:
        print(f"Telegram notify error: {e}")
