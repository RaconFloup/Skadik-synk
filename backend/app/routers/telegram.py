import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.setting import AppSetting

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


class FetchAvatarRequest(BaseModel):
    bot_username: str


class FetchAvatarResponse(BaseModel):
    logo_url: str


class TestTokenRequest(BaseModel):
    token: str


class TestTokenResponse(BaseModel):
    ok: bool
    username: str = ""


@router.post("/fetch-avatar", response_model=FetchAvatarResponse)
async def fetch_avatar(data: FetchAvatarRequest):
    try:
        import asyncio
        async def _fetch():
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"https://t.me/{data.bot_username}")
                if resp.status_code != 200:
                    raise Exception(f"User not found: {resp.status_code}")
                return "https://t.me/i/userpic/320/" + data.bot_username + ".jpg"
        return FetchAvatarResponse(logo_url=await _fetch())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/test-token", response_model=TestTokenResponse)
async def test_token(data: TestTokenRequest, db: Session = Depends(get_db)):
    token = data.token
    if not token:
        row = db.query(AppSetting).filter(AppSetting.key == "telegram_bot_token").first()
        token = row.value if row else ""
    if not token:
        raise HTTPException(status_code=400, detail="Token is empty")
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(f"https://api.telegram.org/bot{token}/getMe")
        result = resp.json()
        if result.get("ok"):
            return TestTokenResponse(ok=True, username=result["result"].get("username", ""))
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