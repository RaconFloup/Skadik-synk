from app.database import SessionLocal
from app.models.setting import AppSetting


def get_settings(keys: list[str]) -> dict:
    db = SessionLocal()
    try:
        rows = db.query(AppSetting).filter(AppSetting.key.in_(keys)).all()
        return {row.key: row.value for row in rows}
    except Exception:
        return {}
    finally:
        db.close()
