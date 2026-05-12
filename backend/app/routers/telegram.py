import base64
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.setting import AppSetting

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


def _send_telegram_msg(token: str, chat_id: str, text: str, topic_id: str | None, proxy: str | None, disable_preview: bool = False) -> dict:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if topic_id:
        payload["message_thread_id"] = topic_id
    if disable_preview:
        payload["disable_web_page_preview"] = True
    try:
        kwargs = {"timeout": 10.0}
        if proxy:
            kwargs["proxies"] = {"all://": proxy}
        with httpx.Client(**kwargs) as client:
            resp = client.post(url, json=payload)
            result = resp.json()
            if result.get("ok"):
                return {"ok": True}
            return {"ok": False, "error": result.get("description", "Unknown error")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


class FetchAvatarRequest(BaseModel):
    bot_username: str


class FetchAvatarResponse(BaseModel):
    logo_url: str


class TestTokenRequest(BaseModel):
    token: str


class TestTokenResponse(BaseModel):
    ok: bool
    username: str = ""


def _get_socks5_proxy(db: Session) -> str | None:
    row = db.query(AppSetting).filter(AppSetting.key == "socks5_proxy").first()
    return row.value if row and row.value else None


def _make_client(proxy: str | None) -> httpx.AsyncClient:
    kwargs = {"timeout": 15.0, "follow_redirects": True}
    if proxy:
        kwargs["proxy"] = proxy
    return httpx.AsyncClient(**kwargs)


@router.post("/fetch-avatar", response_model=FetchAvatarResponse)
async def fetch_avatar(data: FetchAvatarRequest, db: Session = Depends(get_db)):
    proxy = _get_socks5_proxy(db)
    avatar_url = "https://t.me/i/userpic/320/" + data.bot_username + ".jpg"
    try:
        async with _make_client(proxy) as client:
            resp = await client.get(avatar_url)
            if resp.status_code != 200:
                return FetchAvatarResponse(logo_url=avatar_url)
            content_type = resp.headers.get("content-type", "image/jpeg")
            b64 = base64.b64encode(resp.content).decode("utf-8")
            data_url = f"data:{content_type};base64,{b64}"
            return FetchAvatarResponse(logo_url=data_url)
    except Exception:
        return FetchAvatarResponse(logo_url=avatar_url)


@router.post("/test-token", response_model=TestTokenResponse)
async def test_token(data: TestTokenRequest, db: Session = Depends(get_db)):
    token = data.token
    if not token:
        row = db.query(AppSetting).filter(AppSetting.key == "telegram_bot_token").first()
        token = row.value if row else ""
    if not token:
        raise HTTPException(status_code=400, detail="Token is empty")
    proxy = _get_socks5_proxy(db)
    try:
        async with _make_client(proxy) as client:
            resp = await client.get(f"https://api.telegram.org/bot{token}/getMe")
            result = resp.json()
            if result.get("ok"):
                return TestTokenResponse(ok=True, username=result["result"].get("username", ""))
            return TestTokenResponse(ok=False)
    except Exception as e:
        return TestTokenResponse(ok=False)


@router.post("/test-termix")
async def test_termix(db: Session = Depends(get_db)):
    rows = db.query(AppSetting).filter(
        AppSetting.key.in_(["termix_url", "termix_username", "termix_password"])
    ).all()
    s = {row.key: row.value for row in rows}

    url = s.get("termix_url", "")
    username = s.get("termix_username", "")
    password = s.get("termix_password", "")

    if not url or not username or not password:
        return {"ok": False, "error": "Не все настройки заполнены"}

    try:
        async with httpx.AsyncClient(base_url=url, timeout=10.0) as client:
            resp = await client.post("/users/login", json={"username": username, "password": password})
            if resp.status_code == 200:
                return {"ok": True}
            return {"ok": False, "error": resp.text[:200]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("/test-google")
async def test_google(db: Session = Depends(get_db)):
    rows = db.query(AppSetting).filter(
        AppSetting.key.in_(["google_script_url", "google_folder_id"])
    ).all()
    s = {row.key: row.value for row in rows}

    script_url = s.get("google_script_url", "")
    folder_id = s.get("google_folder_id", "")

    if not script_url or not folder_id:
        return {"ok": False, "error": "Не все настройки заполнены"}

    import json
    payload = json.dumps({
        "action": "create",
        "folderId": folder_id,
        "name": "_test_connection.md",
        "content": "# Connection test\nok"
    }).encode("utf-8")

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.post(
                script_url,
                content=payload,
                headers={"Content-Type": "application/json"},
            )
            result = resp.json()
            if result.get("success"):
                file_id = result.get("fileId")
                del_resp = await client.post(
                    script_url,
                    content=json.dumps({"action": "delete", "fileId": file_id}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                return {"ok": True}
            return {"ok": False, "error": result.get("error", "Unknown error")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


class TestNotifyRequest(BaseModel):
    chat_id: str = ""
    topic_id: str = ""
    down_text: str = ""
    up_text: str = ""


@router.post("/test-notify")
async def test_notify(data: TestNotifyRequest, db: Session = Depends(get_db)):
    rows = db.query(AppSetting).filter(
        AppSetting.key.in_(["telegram_bot_token", "socks5_proxy"])
    ).all()
    s = {row.key: row.value for row in rows}
    token = s.get("telegram_bot_token", "")
    proxy = s.get("socks5_proxy", "") or None

    if not token:
        return {"ok": False, "error": "Токен бота не настроен"}

    chat_id = data.chat_id
    if not chat_id:
        row = db.query(AppSetting).filter(AppSetting.key == "uptime_notify_chat_id").first()
        chat_id = row.value if row else ""
    if not chat_id:
        return {"ok": False, "error": "Chat ID не указан"}

    text = data.down_text or data.up_text or ""
    if data.down_text:
        text = data.down_text.replace("{name}", "Test Server").replace("{error}", "тестовая ошибка")
    elif data.up_text:
        text = data.up_text.replace("{name}", "Test Server")
    else:
        text = "🔄 Тестовое уведомление\nМониторинг аптайма: проверка связи"

    return _send_telegram_msg(token, chat_id, text, data.topic_id or None, proxy)


class TestBillingNotifyRequest(BaseModel):
    chat_id: str = ""
    topic_id: str = ""
    template: str = ""


@router.post("/test-notify-billing")
async def test_notify_billing(data: TestBillingNotifyRequest, db: Session = Depends(get_db)):
    rows = db.query(AppSetting).filter(
        AppSetting.key.in_(["telegram_bot_token", "socks5_proxy", "billing_notify_chat_id", "billing_notify_topic_id"])
    ).all()
    s = {row.key: row.value for row in rows}
    token = s.get("telegram_bot_token", "")
    proxy = s.get("socks5_proxy", "") or None

    if not token:
        return {"ok": False, "error": "Токен бота не настроен"}

    chat_id = data.chat_id or s.get("billing_notify_chat_id", "")
    topic_id = data.topic_id or s.get("billing_notify_topic_id", "")

    if not chat_id:
        return {"ok": False, "error": "Chat ID не указан"}

    from app.services.billing_notify import _generate_report
    report = _generate_report(data.template)

    return _send_telegram_msg(token, chat_id, report, topic_id or None, proxy, disable_preview=True)