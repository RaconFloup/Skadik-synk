import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.setting import AppSetting

router = APIRouter(prefix="/api/flags", tags=["flags"])

FLAG_URL = "https://flagcdn.com/w20/{code}.png"


def _get_socks5_proxy(db: Session) -> str | None:
    row = db.query(AppSetting).filter(AppSetting.key == "socks5_proxy").first()
    return row.value if row and row.value else None


@router.get("/{code}.png")
async def get_flag(code: str, db: Session = Depends(get_db)):
    proxy = _get_socks5_proxy(db)
    kwargs = {"timeout": 10.0, "follow_redirects": True}
    if proxy:
        kwargs["proxy"] = proxy
    try:
        async with httpx.AsyncClient(**kwargs) as client:
            resp = await client.get(FLAG_URL.format(code=code))
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code)
            return Response(content=resp.content, media_type="image/png", headers={"Cache-Control": "public, max-age=604800"})
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Failed to fetch flag")
