from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from typing import List

from app.database import get_db, SessionLocal
from app.models.uptime import UptimeMonitor, UptimeCheck
from app.models.activity import ActivityLog
from app.schemas.uptime import (
    UptimeMonitorCreate,
    UptimeMonitorUpdate,
    UptimeMonitorResponse,
    UptimeCheckResponse,
    UptimeMonitorWithStatus,
    DayStat,
    HourlyStat,
)

router = APIRouter(prefix="/api/uptime", tags=["uptime"])


@router.get("", response_model=List[UptimeMonitorWithStatus])
def get_monitors(db: Session = Depends(get_db)):
    monitors = db.query(UptimeMonitor).order_by(UptimeMonitor.created_at.desc()).all()
    if not monitors:
        return []

    now = datetime.now(timezone.utc)
    mids = [m.id for m in monitors]

    last_check_subq = db.query(
        UptimeCheck.monitor_id,
        func.max(UptimeCheck.checked_at).label("max_checked_at"),
    ).filter(UptimeCheck.monitor_id.in_(mids)).group_by(UptimeCheck.monitor_id).subquery()

    last_checks = db.query(UptimeCheck).join(
        last_check_subq,
        and_(
            UptimeCheck.monitor_id == last_check_subq.c.monitor_id,
            UptimeCheck.checked_at == last_check_subq.c.max_checked_at,
        )
    ).all()
    last_check_map = {c.monitor_id: c for c in last_checks}

    recent_cutoff = now - timedelta(hours=24)
    recent_rows = db.query(UptimeCheck).filter(
        UptimeCheck.monitor_id.in_(mids),
        UptimeCheck.checked_at >= recent_cutoff,
    ).order_by(UptimeCheck.monitor_id, UptimeCheck.checked_at.desc()).all()

    recent_map: dict[UUID, list] = {}
    for c in recent_rows:
        recent_map.setdefault(c.monitor_id, []).append(c)
    for mid in recent_map:
        recent_map[mid] = list(reversed(recent_map[mid][:288]))

    def _batch_uptime(cutoff: datetime) -> dict[UUID, float | None]:
        rows = db.query(
            UptimeCheck.monitor_id,
            func.count(UptimeCheck.id).label("total"),
            func.sum(case((UptimeCheck.is_up == True, 1), else_=0)).label("up"),
        ).filter(
            UptimeCheck.monitor_id.in_(mids),
            UptimeCheck.checked_at >= cutoff,
        ).group_by(UptimeCheck.monitor_id).all()
        return {r.monitor_id: round(r.up / r.total * 100, 1) if r.total else None for r in rows}

    uptime_24h_map = _batch_uptime(now - timedelta(hours=24))
    uptime_7d_map = _batch_uptime(now - timedelta(days=7))

    daily_raw = db.query(
        UptimeCheck.monitor_id,
        func.date_trunc('day', UptimeCheck.checked_at).label("day"),
        func.extract('hour', UptimeCheck.checked_at).label("hour"),
        func.count(UptimeCheck.id).label("total"),
        func.sum(case((UptimeCheck.is_up == True, 1), else_=0)).label("up"),
        func.avg(UptimeCheck.response_time_ms).label("avg_ms"),
    ).filter(
        UptimeCheck.monitor_id.in_(mids),
        UptimeCheck.checked_at >= now - timedelta(days=6),
    ).group_by(
        UptimeCheck.monitor_id,
        func.date_trunc('day', UptimeCheck.checked_at),
        func.extract('hour', UptimeCheck.checked_at),
    ).order_by(
        UptimeCheck.monitor_id,
        func.date_trunc('day', UptimeCheck.checked_at),
        func.extract('hour', UptimeCheck.checked_at),
    ).all()

    daily_map: dict[UUID, dict[str, list]] = {}
    for r in daily_raw:
        daily_map.setdefault(r.monitor_id, {})
        day_str = r.day.strftime("%Y-%m-%d") if hasattr(r.day, 'strftime') else str(r.day)
        daily_map[r.monitor_id].setdefault(day_str, []).append(r)

    result = []
    for m in monitors:
        mid = m.id
        raw_days = daily_map.get(mid, {})

        daily_stats: list[DayStat] = []
        for day_str in sorted(raw_days.keys()):
            hours = raw_days[day_str]
            day_up = sum(int(r.up) for r in hours)
            day_total = sum(int(r.total) for r in hours)
            day_avg_all = [r.avg_ms for r in hours if r.avg_ms is not None]
            day_avg = round(sum(day_avg_all) / len(day_avg_all), 1) if day_avg_all else None
            hourly = [
                HourlyStat(hour=int(r.hour), up=int(r.up), total=int(r.total))
                for r in hours
            ]
            daily_stats.append(DayStat(
                date=day_str,
                up=day_up,
                down=day_total - day_up,
                total=day_total,
                avg_response_ms=day_avg,
                hourly=hourly,
            ))

        result.append(UptimeMonitorWithStatus(
            monitor=m,
            last_check=last_check_map.get(mid),
            recent_checks=recent_map.get(mid, []),
            uptime_24h=uptime_24h_map.get(mid),
            uptime_7d=uptime_7d_map.get(mid),
            daily_stats=daily_stats,
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

    if "is_active" in update_data:
        now_str = datetime.now(timezone.utc).strftime("%H:%M")
        if monitor.is_active:
            text = f"Мониторинг аптайма: {monitor.name} — включён"
        else:
            text = f"Мониторинг аптайма: {monitor.name} — отключён"
        activity = ActivityLog(text=text, time=now_str)
        db.add(activity)
        db.commit()

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
