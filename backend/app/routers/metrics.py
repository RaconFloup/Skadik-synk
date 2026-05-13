from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models.host_metric import (
    HostMetricSnapshot,
    HostMetricRollup1m,
    HostMetricRollup5m,
    HostMetricRollup10m,
)
from app.models.server import Server
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


def get_router():
    return router


def _select_model(minutes: int):
    if minutes <= 10:
        return HostMetricSnapshot
    elif minutes <= 60:
        return HostMetricRollup1m
    elif minutes <= 480:
        return HostMetricRollup5m
    else:
        return HostMetricRollup10m


@router.get("/{host_id}")
def get_metrics(host_id: int, db: Session = Depends(get_db)):
    server = db.query(Server).filter(
        Server.termix_host_id == str(host_id)
    ).first()
    if not server:
        return {}

    latest = (
        db.query(HostMetricSnapshot)
        .filter(HostMetricSnapshot.server_id == server.id)
        .order_by(desc(HostMetricSnapshot.recorded_at))
        .first()
    )
    if not latest:
        return {}

    return {
        "cpu": {
            "percent": latest.cpu_percent,
            "cores": latest.cpu_cores,
        },
        "memory": {
            "percent": latest.memory_percent,
            "usedGiB": latest.memory_used_gib,
            "totalGiB": latest.memory_total_gib,
        },
        "disk": {
            "percent": latest.disk_percent,
            "usedHuman": latest.disk_used_human,
            "totalHuman": latest.disk_total_human,
        },
        "uptime": {
            "formatted": latest.uptime_formatted,
            "seconds": latest.uptime_seconds,
        } if hasattr(latest, "uptime_formatted") else None,
        "system": {
            "hostname": latest.system_hostname,
            "kernel": latest.system_kernel,
            "os": latest.system_os,
        } if hasattr(latest, "system_hostname") else None,
        "lastChecked": latest.recorded_at.isoformat() if latest.recorded_at else None,
    }


@router.get("/{host_id}/history")
def get_metrics_history(
    host_id: int,
    minutes: int = Query(10, ge=5, le=2880),
    db: Session = Depends(get_db),
):
    server = db.query(Server).filter(
        Server.termix_host_id == str(host_id)
    ).first()
    if not server:
        return []

    model = _select_model(minutes)
    cutoff = datetime.utcnow() - timedelta(minutes=minutes)

    snapshots = (
        db.query(model)
        .filter(
            model.server_id == server.id,
            model.recorded_at >= cutoff,
        )
        .order_by(model.recorded_at.asc())
        .all()
    )

    return [
        {
            "t": s.recorded_at.isoformat() if s.recorded_at else None,
            "cpu": s.cpu_percent,
            "mem": s.memory_percent,
            "mem_used": s.memory_used_gib,
            "mem_total": s.memory_total_gib,
            "disk": s.disk_percent,
            "disk_used": s.disk_used_human if hasattr(s, "disk_used_human") else None,
            "disk_total": s.disk_total_human if hasattr(s, "disk_total_human") else None,
        }
        for s in snapshots
    ]
