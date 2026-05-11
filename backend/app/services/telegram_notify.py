from datetime import datetime, timezone

import httpx

from app.database import SessionLocal
from app.models.setting import AppSetting
from app.models.notification_queue import NotificationQueue


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


def _try_send(token: str, chat_id: str, text: str, topic_id: str | None, proxy: str | None) -> str | None:
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
            resp = client.post(url, json=payload)
            if resp.status_code < 500:
                return None
            return f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return str(e)


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
            text = (
                f"\u2705 <b>{monitor_name}</b>\n"
                f"\u041c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433 "
                f"\u0430\u043f\u0442\u0430\u0439\u043c\u0430: \u0441\u0435\u0440\u0432\u0435\u0440 "
                f"\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d"
            )
    else:
        err_text = error or "\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u0435 \u043f\u043e\u0442\u0435\u0440\u044f\u043d\u043e"
        if down_template:
            text = down_template.replace("{name}", monitor_name).replace("{error}", err_text)
        else:
            text = (
                f"\u274c <b>{monitor_name}</b>\n"
                f"\u041c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433 "
                f"\u0430\u043f\u0442\u0430\u0439\u043c\u0430: \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d\n"
                f"{err_text}"
            )

    err = _try_send(token, chat_id, text, topic_id, proxy)
    if err is not None:
        _save_to_queue(chat_id, topic_id, text, err)


def _save_to_queue(chat_id: str, topic_id: str | None, text: str, error: str):
    db = SessionLocal()
    try:
        entry = NotificationQueue(
            chat_id=chat_id,
            topic_id=topic_id or "",
            text=text,
            retry_count=0,
            last_error=error,
            next_retry_at=datetime.now(timezone.utc),
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        print(f"Failed to save notification to queue: {e}")
        db.rollback()
    finally:
        db.close()


def process_notification_queue():
    settings = _get_notify_settings()
    token = settings.get("telegram_bot_token", "")
    proxy = settings.get("socks5_proxy", "") or None

    if not token:
        return

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        entries = (
            db.query(NotificationQueue)
            .filter(NotificationQueue.next_retry_at <= now)
            .order_by(NotificationQueue.created_at.asc())
            .limit(50)
            .all()
        )
        if not entries:
            return

        for entry in entries:
            err = _try_send(token, entry.chat_id, entry.text, entry.topic_id or None, proxy)
            if err is None:
                db.delete(entry)
            else:
                entry.retry_count = (entry.retry_count or 0) + 1
                entry.last_error = err
                backoff = min(30 * (entry.retry_count ** 2), 3600)
                from datetime import timedelta
                entry.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=backoff)
        db.commit()
    except Exception as e:
        print(f"Notification queue processing error: {e}")
        db.rollback()
    finally:
        db.close()
