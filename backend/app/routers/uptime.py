from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db, SessionLocal
from app.models.uptime import UptimeMonitor, UptimeCheck
from app.schemas.uptime import (
    UptimeMonitorCreate,
    UptimeMonitorUpdate,
    UptimeMonitorResponse,
    UptimeCheckResponse,
    UptimeMonitorWithStatus,
)

router = APIRouter(prefix="/api/uptime", tags=["uptime"])


def _calc_uptime(db: Session, monitor_id: UUID, since: datetime) -> float | None:
    total = db.query(func.count(UptimeCheck.id)).filter(
        UptimeCheck.monitor_id == monitor_id,
        UptimeCheck.checked_at >= since,
    ).scalar()
    if not total:
        return None
    up = db.query(func.count(UptimeCheck.id)).filter(
        UptimeCheck.monitor_id == monitor_id,
        UptimeCheck.is_up == True,
        UptimeCheck.checked_at >= since,
    ).scalar()
    return round(up / total * 100, 1)


@router.get("", response_model=List[UptimeMonitorWithStatus])
def get_monitors(db: Session = Depends(get_db)):
    monitors = db.query(UptimeMonitor).order_by(UptimeMonitor.created_at.desc()).all()
    now = datetime.now(timezone.utc)
    result = []
    for m in monitors:
        last_check = db.query(UptimeCheck).filter(
            UptimeCheck.monitor_id == m.id
        ).order_by(UptimeCheck.checked_at.desc()).first()
        recent_checks = db.query(UptimeCheck).filter(
            UptimeCheck.monitor_id == m.id
        ).order_by(UptimeCheck.checked_at.desc()).all()
        recent_checks.reverse()
        uptime_24h = _calc_uptime(db, m.id, now - timedelta(hours=24))
        uptime_7d = _calc_uptime(db, m.id, now - timedelta(days=7))
        result.append(UptimeMonitorWithStatus(
            monitor=m,
            last_check=last_check,
            recent_checks=recent_checks,
            uptime_24h=uptime_24h,
            uptime_7d=uptime_7d,
        ))
    return result


@router.post("", response_model=UptimeMonitorResponse, status_code=status.HTTP_201_CREATED)
def create_monitor(data: UptimeMonitorCreate, db: Session = Depends(get_db)):
    server_id = UUID(data.server_id) if data.server_id else None
    monitor = UptimeMonitor(
        server_id=server_id,
        name=data.name,
        host=data.host,
        port=data.port,
        check_interval=data.check_interval,
        is_active=data.is_active,
    )
    db.add(monitor)
    db.commit()
    db.refresh(monitor)
    return monitor


@router.put("/{monitor_id}", response_model=UptimeMonitorResponse)
def update_monitor(monitor_id: UUID, data: UptimeMonitorUpdate, db: Session = Depends(get_db)):
    monitor = db.query(UptimeMonitor).filter(UptimeMonitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(monitor, key, value)
    db.commit()
    db.refresh(monitor)
    return monitor


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_monitor(monitor_id: UUID, db: Session = Depends(get_db)):
    monitor = db.query(UptimeMonitor).filter(UptimeMonitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    db.query(UptimeCheck).filter(UptimeCheck.monitor_id == monitor_id).delete()
    db.delete(monitor)
    db.commit()


@router.get("/{monitor_id}/checks", response_model=List[UptimeCheckResponse])
def get_checks(monitor_id: UUID, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(UptimeCheck).filter(
        UptimeCheck.monitor_id == monitor_id
    ).order_by(UptimeCheck.checked_at.desc()).limit(limit).all()


@router.post("/{monitor_id}/check-now")
async def check_now(monitor_id: UUID, db: Session = Depends(get_db)):
    from app.services.uptime_checker import _tcp_check
    monitor = db.query(UptimeMonitor).filter(UptimeMonitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    is_up, response_time_ms, error = await _tcp_check(monitor.host, monitor.port)
    check = UptimeCheck(
        monitor_id=monitor.id,
        is_up=is_up,
        response_time_ms=response_time_ms,
        error=error,
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    return {
        "id": str(check.id),
        "is_up": is_up,
        "response_time_ms": response_time_ms,
        "error": error,
        "checked_at": check.checked_at.isoformat() if check.checked_at else None,
    }


@router.post("/restart-scheduler")
def restart_scheduler():
    from app.services.uptime_checker import restart_scheduler as _restart
    return _restart()
