import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.telegram import fetch_bot_avatar
from app.config import settings

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
        logo_url = await fetch_bot_avatar(data.bot_username)
        return FetchAvatarResponse(logo_url=logo_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/test-token", response_model=TestTokenResponse)
async def test_token(data: TestTokenRequest):
    token = data.token or settings.TELEGRAM_BOT_TOKEN
    if not token:
        raise HTTPException(status_code=400, detail="Token is empty")
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(f"https://api.telegram.org/bot{token}/getMe")
        result = resp.json()
        if result.get("ok"):
            return TestTokenResponse(ok=True, username=result["result"].get("username", ""))
        return TestTokenResponse(ok=False)
