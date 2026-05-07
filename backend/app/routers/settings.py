from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict

from app.database import get_db
from app.models.setting import AppSetting

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=Dict[str, str])
def get_settings(db: Session = Depends(get_db)):
    rows = db.query(AppSetting).all()
    return {row.key: row.value for row in rows}


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
