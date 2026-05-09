from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx
from datetime import datetime, timezone

from app.database import get_db
from app.models.setting import AppSetting

router = APIRouter(prefix="/api/exchange-rates", tags=["exchange-rates"])

EXTERNAL_API = "https://api.exchangerate-api.com/v4/latest/USD"
CACHE_TTL_HOURS = 1


def _fetch_rates() -> dict:
    resp = httpx.get(EXTERNAL_API, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _read_cached(db: Session) -> tuple[dict | None, str | None]:
    rates_row = db.query(AppSetting).filter(AppSetting.key == "exchange_rates").first()
    time_row = db.query(AppSetting).filter(AppSetting.key == "exchange_rates_updated_at").first()
    if rates_row and rates_row.value:
        try:
            import json
            rates = json.loads(rates_row.value)
        except json.JSONDecodeError:
            rates = None
    else:
        rates = None
    updated_at = time_row.value if time_row else None
    return rates, updated_at


def _save_rates(db: Session, data: dict):
    import json
    rates = data.get("rates", {})
    now = datetime.now(timezone.utc).isoformat()

    row = db.query(AppSetting).filter(AppSetting.key == "exchange_rates").first()
    if row:
        row.value = json.dumps(rates)
    else:
        db.add(AppSetting(key="exchange_rates", value=json.dumps(rates)))

    row = db.query(AppSetting).filter(AppSetting.key == "exchange_rates_updated_at").first()
    if row:
        row.value = now
    else:
        db.add(AppSetting(key="exchange_rates_updated_at", value=now))

    db.commit()


def _is_stale(updated_at: str | None) -> bool:
    if not updated_at:
        return True
    try:
        parsed = datetime.fromisoformat(updated_at)
        delta = datetime.now(timezone.utc) - parsed
        return delta.total_seconds() > CACHE_TTL_HOURS * 3600
    except (ValueError, TypeError):
        return True


def _response(rates: dict | None, updated_at: str | None) -> dict:
    return {
        "rates": rates or {},
        "updated_at": updated_at,
    }


@router.get("")
def get_exchange_rates(db: Session = Depends(get_db)):
    rates, updated_at = _read_cached(db)

    if _is_stale(updated_at):
        try:
            data = _fetch_rates()
            _save_rates(db, data)
            rates, updated_at = _read_cached(db)
        except Exception:
            if rates is None:
                raise HTTPException(status_code=502, detail="Failed to fetch exchange rates")
            return _response(rates, updated_at)

    return _response(rates, updated_at)


@router.post("/refresh")
def refresh_exchange_rates(db: Session = Depends(get_db)):
    try:
        data = _fetch_rates()
        _save_rates(db, data)
        rates, updated_at = _read_cached(db)
        return _response(rates, updated_at)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
