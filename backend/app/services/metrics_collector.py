import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.server import Server
from app.models.setting import AppSetting
from app.models.host_metric import (
    HostMetricSnapshot,
    HostMetricRollup1m,
    HostMetricRollup5m,
    HostMetricRollup10m,
)
from app.services.ssh_collector import collect as ssh_collect

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

ROLLUP_MODELS = [
    (HostMetricSnapshot, 10),          # RAW: 10 min
    (HostMetricRollup1m, 60),          # 1m: 1 hour
    (HostMetricRollup5m, 480),         # 5m: 8 hours
    (HostMetricRollup10m, 1440),       # 10m: 24 hours
]

ROLLUP_INTERVALS = [
    (HostMetricSnapshot, HostMetricRollup1m, 60, 60),    # RAW→1m every 60s, TTL 60min
    (HostMetricRollup1m, HostMetricRollup5m, 300, 480),  # 1m→5m every 300s, TTL 480min
    (HostMetricRollup5m, HostMetricRollup10m, 600, 1440),# 5m→10m every 600s, TTL 1440min
]


_loop = None

def _get_loop():
    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
    return _loop


# ── Poll & store RAW (every 5s) ──────────────────────────────────────

def _load_enabled_metrics(db: Session) -> list[str]:
    row = db.query(AppSetting).filter(AppSetting.key == "monitoring_metrics").first()
    if row and row.value:
        try:
            val = json.loads(row.value)
            if isinstance(val, list):
                return val
        except (json.JSONDecodeError, TypeError):
            pass
    return ["cpu", "memory", "disk", "uptime", "system"]


async def _poll_and_store(server: Server, enabled_metrics: list[str]) -> None:
    data = await ssh_collect(server, enabled_metrics)
    if not data or not data.get("lastChecked"):
        return

    cpu = data.get("cpu", {}) or {}
    mem = data.get("memory", {}) or {}
    disk = data.get("disk", {}) or {}
    uptime = data.get("uptime") or {}
    system = data.get("system") or {}

    db = SessionLocal()
    try:
        snapshot = HostMetricSnapshot(
            server_id=server.id,
            cpu_percent=cpu.get("percent"),
            cpu_cores=cpu.get("cores"),
            memory_percent=mem.get("percent"),
            memory_used_gib=mem.get("usedGiB"),
            memory_total_gib=mem.get("totalGiB"),
            disk_percent=disk.get("percent"),
            disk_used_human=disk.get("usedHuman"),
            disk_total_human=disk.get("totalHuman"),
            uptime_formatted=uptime.get("formatted"),
            uptime_seconds=uptime.get("seconds"),
            system_hostname=system.get("hostname"),
            system_kernel=system.get("kernel"),
            system_os=system.get("os"),
        )
        db.add(snapshot)
        db.commit()
    except Exception as e:
        logger.error("Metrics store fail: %s", e)
        db.rollback()
    finally:
        db.close()


async def _poll_all():
    db = SessionLocal()
    try:
        servers = db.query(Server).filter(
            Server.termix_host_id.isnot(None),
            Server.termix_host_id != "",
        ).all()
        enabled_metrics = _load_enabled_metrics(db)
    except Exception as e:
        logger.error("Poll query fail: %s", e)
        return
    finally:
        db.close()

    tasks = [_poll_and_store(srv, enabled_metrics) for srv in servers]
    await asyncio.gather(*tasks)


def _poll_all_sync():
    loop = _get_loop()
    loop.run_until_complete(_poll_all())


# ── Rollup helpers ────────────────────────────────────────────────────

def _bucket_ts(t: datetime, bucket_seconds: int) -> datetime:
    """Round a timestamp down to the start of its bucket."""
    epoch = int(t.timestamp())
    return datetime.utcfromtimestamp((epoch // bucket_seconds) * bucket_seconds)


def _do_rollup(src_model, dst_model, window_seconds: int, bucket_seconds: int, db: Session):
    cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)

    records = (
        db.query(src_model)
        .filter(src_model.recorded_at >= cutoff)
        .all()
    )

    buckets: dict[tuple[uuid.UUID, datetime], list] = {}
    for r in records:
        bt = _bucket_ts(r.recorded_at, bucket_seconds)
        buckets.setdefault((r.server_id, bt), []).append(r)

    for (srv_id, bt), group in buckets.items():
        n = len(group)
        cpu_pct = sum(r.cpu_percent or 0 for r in group) / n
        cpu_core = sum(r.cpu_cores or 0 for r in group) / n
        mem_pct = sum(r.memory_percent or 0 for r in group) / n
        mem_used = sum(r.memory_used_gib or 0 for r in group) / n
        mem_total = sum(r.memory_total_gib or 0 for r in group) / n
        disk_pct = sum(r.disk_percent or 0 for r in group) / n

        db.query(dst_model).filter(
            dst_model.server_id == srv_id,
            dst_model.recorded_at == bt,
        ).delete()
        db.add(dst_model(
            server_id=srv_id,
            recorded_at=bt,
            cpu_percent=cpu_pct,
            cpu_cores=cpu_core,
            memory_percent=mem_pct,
            memory_used_gib=mem_used,
            memory_total_gib=mem_total,
            disk_percent=disk_pct,
        ))
    db.commit()


def _rollup_1m():
    db = SessionLocal()
    try:
        _do_rollup(HostMetricSnapshot, HostMetricRollup1m, 120, 60, db)
    except Exception as e:
        logger.error("Rollup 1m fail: %s", e)
        db.rollback()
    finally:
        db.close()


def _rollup_5m():
    db = SessionLocal()
    try:
        _do_rollup(HostMetricRollup1m, HostMetricRollup5m, 360, 300, db)
    except Exception as e:
        logger.error("Rollup 5m fail: %s", e)
        db.rollback()
    finally:
        db.close()


def _rollup_10m():
    db = SessionLocal()
    try:
        _do_rollup(HostMetricRollup5m, HostMetricRollup10m, 660, 600, db)
    except Exception as e:
        logger.error("Rollup 10m fail: %s", e)
        db.rollback()
    finally:
        db.close()


# ── Cleanup ───────────────────────────────────────────────────────────

def _cleanup():
    db = SessionLocal()
    try:
        for model, ttl_minutes in ROLLUP_MODELS:
            cutoff = datetime.utcnow() - timedelta(minutes=ttl_minutes)
            deleted = db.query(model).filter(model.recorded_at < cutoff).delete()
            if deleted:
                db.commit()
                logger.info("Cleaned %d from %s (ttl=%dmin)", deleted, model.__tablename__, ttl_minutes)
    except Exception as e:
        logger.error("Cleanup fail: %s", e)
        db.rollback()
    finally:
        db.close()


# ── Scheduler ─────────────────────────────────────────────────────────

async def start_collector():
    scheduler.add_job(_poll_all_sync, "interval", seconds=5, id="poll_metrics", max_instances=1, misfire_grace_time=3)
    scheduler.add_job(_rollup_1m, "interval", seconds=60, id="rollup_1m", max_instances=1, misfire_grace_time=10)
    scheduler.add_job(_rollup_5m, "interval", seconds=300, id="rollup_5m", max_instances=1, misfire_grace_time=30)
    scheduler.add_job(_rollup_10m, "interval", seconds=600, id="rollup_10m", max_instances=1, misfire_grace_time=60)
    scheduler.add_job(_cleanup, "interval", seconds=60, id="cleanup_metrics", max_instances=1, misfire_grace_time=10)

    if not scheduler.running:
        scheduler.start()


def stop_collector():
    if scheduler.running:
        scheduler.shutdown(wait=False)
