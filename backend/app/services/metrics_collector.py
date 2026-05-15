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


# ── Poll & store RAW ──────────────────────────────────────

def _load_enabled_metrics(db: Session) -> list[str]:
    row = db.query(AppSetting).filter(AppSetting.key == "monitoring_metrics").first()
    if row and row.value:
        try:
            val = json.loads(row.value)
            if isinstance(val, list):
                return val
        except (json.JSONDecodeError, TypeError):
            pass
    return ["cpu", "memory", "disk", "uptime", "system", "load", "diskio", "traffic", "netstat", "processes", "docker", "sshsessions"]


def _load_intervals(db: Session) -> tuple[int, int]:
    light = 5
    heavy = 30
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "monitoring_light_interval").first()
        if row and row.value:
            light = max(3, int(row.value))
        row = db.query(AppSetting).filter(AppSetting.key == "monitoring_heavy_interval").first()
        if row and row.value:
            heavy = max(5, int(row.value))
    except (ValueError, TypeError):
        pass
    return light, heavy


_current_light_interval: int = 5


async def _poll_and_store(server: Server, enabled_metrics: list[str], heavy_interval: int) -> None:
    data = await ssh_collect(server, enabled_metrics, heavy_interval=heavy_interval)
    if not data or not data.get("lastChecked"):
        return

    cpu = data.get("cpu", {}) or {}
    mem = data.get("memory", {}) or {}
    disk = data.get("disk", {}) or {}
    uptime = data.get("uptime") or {}
    system = data.get("system") or {}
    load = data.get("load") or {}
    swap = data.get("swap") or {}
    diskio = data.get("diskio") or {}
    netstat = data.get("netstat") or {}
    docker = data.get("docker") or {}
    containers = docker.get("containers") if docker else None

    traffic = data.get("traffic")
    processes = data.get("processes")
    sshsessions = data.get("sshsessions")

    cpu_ticks = cpu.get("ticks")
    cpu_cores = cpu.get("cores")

    db = SessionLocal()
    try:
        prev = db.query(HostMetricSnapshot).filter(
            HostMetricSnapshot.server_id == server.id
        ).order_by(HostMetricSnapshot.recorded_at.desc()).first()

        cpu_percent = None
        if cpu_ticks and prev and prev.cpu_ticks_json:
            pt = prev.cpu_ticks_json
            cur_total = cpu_ticks["user"] + cpu_ticks["nice"] + cpu_ticks["system"] + cpu_ticks["idle"]
            prev_total = pt["user"] + pt["nice"] + pt["system"] + pt["idle"]
            d_total = cur_total - prev_total
            d_idle = cpu_ticks["idle"] - pt["idle"]
            if d_total > 0:
                cpu_percent = round((d_total - d_idle) / d_total * 100, 1)

        if not netstat and not docker and not processes and prev:
                netstat = {"established": prev.net_established, "timeWait": prev.net_time_wait} if prev.net_established is not None else {}
                docker = {"running": prev.docker_running, "total": prev.docker_total} if prev.docker_running is not None else {}
                processes = prev.top_processes_json or []
                traffic = prev.traffic_json or []
                containers = prev.containers_json or []
                sshsessions = prev.sshsessions_json

        snapshot = HostMetricSnapshot(
            server_id=server.id,
            cpu_percent=cpu_percent,
            cpu_cores=cpu_cores,
            cpu_ticks_json=cpu_ticks,
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
            load_1m=load.get("1m"),
            load_5m=load.get("5m"),
            load_15m=load.get("15m"),
            swap_percent=swap.get("percent"),
            swap_used_gib=swap.get("usedGiB"),
            swap_total_gib=swap.get("totalGiB"),
            disk_io_read_mb=diskio.get("readMb"),
            disk_io_write_mb=diskio.get("writeMb"),
            disk_io_json=diskio,
            net_established=netstat.get("established") if netstat else None,
            net_time_wait=netstat.get("timeWait") if netstat else None,
            docker_running=docker.get("running") if docker else None,
            docker_total=docker.get("total") if docker else None,
            containers_json=containers,
            traffic_json=traffic,
            top_processes_json=processes,
            sshsessions_json=sshsessions,
        )
        db.add(snapshot)
        db.commit()
    except Exception as e:
        logger.error("Metrics store fail: %s", e)
        db.rollback()
    finally:
        db.close()


async def _poll_all():
    global _current_light_interval
    db = SessionLocal()
    try:
        servers = db.query(Server).filter(
            Server.termix_host_id.isnot(None),
            Server.termix_host_id != "",
        ).all()
        light_interval, heavy_interval = _load_intervals(db)
        enabled_metrics = _load_enabled_metrics(db)

        if light_interval != _current_light_interval:
            scheduler.reschedule_job("poll_metrics", trigger="interval", seconds=light_interval)
            _current_light_interval = light_interval
            logger.info("Poll interval changed to %ds", light_interval)
    except Exception as e:
        logger.error("Poll query fail: %s", e)
        return
    finally:
        db.close()

    tasks = [_poll_and_store(srv, enabled_metrics, heavy_interval) for srv in servers]
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
        def avg(attr):
            vals = [getattr(r, attr) for r in group if getattr(r, attr) is not None]
            return sum(vals) / len(vals) if vals else None

        # JSON-поля от последнего снепшота в окне
        group.sort(key=lambda r: r.recorded_at)
        last_traffic = getattr(group[-1], "traffic_json", None)
        last_disk_io = getattr(group[-1], "disk_io_json", None)

        db.query(dst_model).filter(
            dst_model.server_id == srv_id,
            dst_model.recorded_at == bt,
        ).delete()
        db.add(dst_model(
            server_id=srv_id,
            recorded_at=bt,
            cpu_percent=avg("cpu_percent"),
            cpu_cores=avg("cpu_cores"),
            memory_percent=avg("memory_percent"),
            memory_used_gib=avg("memory_used_gib"),
            memory_total_gib=avg("memory_total_gib"),
            disk_percent=avg("disk_percent"),
            load_1m=avg("load_1m"),
            load_5m=avg("load_5m"),
            load_15m=avg("load_15m"),
            swap_percent=avg("swap_percent"),
            swap_used_gib=avg("swap_used_gib"),
            swap_total_gib=avg("swap_total_gib"),
            disk_io_read_mb=avg("disk_io_read_mb"),
            disk_io_write_mb=avg("disk_io_write_mb"),
            net_established=avg("net_established"),
            net_time_wait=avg("net_time_wait"),
            docker_running=avg("docker_running"),
            docker_total=avg("docker_total"),
            traffic_json=last_traffic,
            disk_io_json=last_disk_io,
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
    db = SessionLocal()
    try:
        initial_light = 5
        row = db.query(AppSetting).filter(AppSetting.key == "monitoring_light_interval").first()
        if row and row.value:
            try:
                initial_light = max(3, int(row.value))
            except ValueError:
                pass
    finally:
        db.close()
    global _current_light_interval
    _current_light_interval = initial_light

    scheduler.add_job(_poll_all_sync, "interval", seconds=initial_light, id="poll_metrics", max_instances=1, misfire_grace_time=3)
    scheduler.add_job(_rollup_1m, "interval", seconds=60, id="rollup_1m", max_instances=1, misfire_grace_time=10)
    scheduler.add_job(_rollup_5m, "interval", seconds=300, id="rollup_5m", max_instances=1, misfire_grace_time=30)
    scheduler.add_job(_rollup_10m, "interval", seconds=600, id="rollup_10m", max_instances=1, misfire_grace_time=60)
    scheduler.add_job(_cleanup, "interval", seconds=60, id="cleanup_metrics", max_instances=1, misfire_grace_time=10)

    if not scheduler.running:
        scheduler.start()


def stop_collector():
    if scheduler.running:
        scheduler.shutdown(wait=False)
