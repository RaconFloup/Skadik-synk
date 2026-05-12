import json
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.setting import AppSetting
from app.models.server import Server


def _load_currencies(db: Session) -> list[str]:
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "currencies").first()
        if row and row.value:
            items = json.loads(row.value)
            if isinstance(items, list) and len(items) > 0:
                return items
    except Exception:
        pass
    return ["USD", "RUB", "EUR"]


def _load_exchange_rates(db: Session) -> dict[str, float]:
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "exchange_rates").first()
        if row and row.value:
            return json.loads(row.value)
    except Exception:
        pass
    return {}


def _convert(amount: float, from_cur: str, to_cur: str, rates: dict) -> float:
    if not amount or not from_cur or not to_cur or from_cur == to_cur:
        return amount
    rate_from = rates.get(from_cur)
    rate_to = rates.get(to_cur)
    if rate_from and rate_to:
        return round(amount * rate_to / rate_from, 2)
    return amount


def recalc_server_costs(db: Session, server: Server, rates: dict | None = None):
    if rates is None:
        rates = _load_exchange_rates(db)
    currencies = _load_currencies(db)

    cost_val = float(server.cost) if server.cost else 0
    if not cost_val:
        server.costs = {}
        return

    cur = server.currency or "USD"
    costs = {}
    for c in currencies:
        costs[c] = _convert(cost_val, cur, c, rates)
    server.costs = costs


def recalc_all_server_costs(db: Session | None = None):
    close_db = db is None
    if db is None:
        db = SessionLocal()
    try:
        rates = _load_exchange_rates(db)
        servers = db.query(Server).all()
        for s in servers:
            recalc_server_costs(db, s, rates)
        db.commit()
    except Exception as e:
        print(f"Error recalculating costs: {e}")
        if db.is_active:
            db.rollback()
    finally:
        if close_db:
            db.close()
