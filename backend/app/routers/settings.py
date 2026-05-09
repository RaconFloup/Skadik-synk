import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Dict

from app.database import get_db
from app.models.setting import AppSetting

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/public")
def get_public_settings(db: Session = Depends(get_db)):
    rows = db.query(AppSetting).filter(
        AppSetting.key.in_(["app_logo", "app_name"])
    ).all()
    return {row.key: row.value for row in rows}


@router.get("", response_model=Dict[str, str])
def get_settings(db: Session = Depends(get_db)):
    rows = db.query(AppSetting).all()
    return {row.key: row.value for row in rows}


class Socks5TestResponse(BaseModel):
    ok: bool
    error: str = ""


@router.post("/socks5-test", response_model=Socks5TestResponse)
async def test_socks5_proxy(db: Session = Depends(get_db)):
    row = db.query(AppSetting).filter(AppSetting.key == "socks5_proxy").first()
    proxy = row.value if row and row.value else ""
    if not proxy:
        return Socks5TestResponse(ok=False, error="Прокси не настроен")

    try:
        async with httpx.AsyncClient(proxy=proxy, timeout=10.0) as client:
            resp = await client.get("https://api.telegram.org")
            return Socks5TestResponse(ok=resp.status_code < 500)
    except Exception as e:
        return Socks5TestResponse(ok=False, error=str(e))


@router.put("", response_model=Dict[str, str])
def update_settings(data: Dict[str, str], db: Session = Depends(get_db)):
    for key, value in data.items():
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value = value
        else:
            row = AppSetting(key=key, value=value)
            db.add(row)
    db.commit()

    rows = db.query(AppSetting).all()
    return {row.key: row.value for row in rows}
