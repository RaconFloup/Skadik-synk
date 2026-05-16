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


def _select_model(minutes: int):
    if minutes <= 10:
        return HostMetricSnapshot
    elif minutes <= 60:
        return HostMetricRollup1m
    elif minutes <= 480:
        return HostMetricRollup5m
    else:
        return HostMetricRollup10m


def _compute_traffic_speed(current, previous):
    if not current or not previous:
        return None
    ct = getattr(current, "traffic_json", None)
    pt = getattr(previous, "traffic_json", None)
    if not ct or not pt:
        return None
    cur_t = current.recorded_at.timestamp() if current.recorded_at else None
    prev_t = previous.recorded_at.timestamp() if previous.recorded_at else None
    if not cur_t or not prev_t or cur_t == prev_t:
        return None
    delta = cur_t - prev_t
    prev_map = {i["name"]: i for i in pt}
    speeds = []
    for iface in ct:
        n = iface["name"]
        p = prev_map.get(n)
        if p:
            rx = round(max(0, (iface["rxBytes"] - p["rxBytes"])) / delta, 1)
            tx = round(max(0, (iface["txBytes"] - p["txBytes"])) / delta, 1)
        else:
            rx = 0
            tx = 0
        speeds.append({"name": n, "rxBytesPerSec": rx, "txBytesPerSec": tx})
    return speeds


def _compute_disk_io(current, previous):
    if not current or not previous:
        return None
    cd = getattr(current, "disk_io_json", None)
    pd = getattr(previous, "disk_io_json", None)
    if not cd or not pd:
        return None
    cur_t = current.recorded_at.timestamp() if current.recorded_at else None
    prev_t = previous.recorded_at.timestamp() if previous.recorded_at else None
    if not cur_t or not prev_t or cur_t == prev_t:
        return None
    delta = cur_t - prev_t

    read_sectors = cd.get("readSectors", 0) - pd.get("readSectors", 0)
    write_sectors = cd.get("writeSectors", 0) - pd.get("writeSectors", 0)
    read_ops = cd.get("readOps", 0) - pd.get("readOps", 0)
    write_ops = cd.get("writeOps", 0) - pd.get("writeOps", 0)
    io_time_delta = cd.get("ioTimeMs", 0) - pd.get("ioTimeMs", 0)

    if read_sectors < 0 or write_sectors < 0 or read_ops < 0 or write_ops < 0 or io_time_delta < 0:
        return None

    return {
        "readMbPerSec": round(read_sectors * 512 / 1024 / 1024 / delta, 2),
        "writeMbPerSec": round(write_sectors * 512 / 1024 / 1024 / delta, 2),
        "readIops": round(read_ops / delta, 1),
        "writeIops": round(write_ops / delta, 1),
        "utilizationPercent": round(min(100, io_time_delta / (delta * 1000) * 100), 1),
        "iopsInProgress": cd.get("iopsInProgress", 0),
    }


def _snap_to_dict(s):
    base = {
        "cpu": {"percent": s.cpu_percent, "cores": s.cpu_cores} if s.cpu_percent is not None else None,
        "memory": {"percent": s.memory_percent, "usedGiB": s.memory_used_gib, "totalGiB": s.memory_total_gib} if s.memory_percent is not None else None,
        "disk": {"percent": s.disk_percent, "usedHuman": s.disk_used_human, "totalHuman": s.disk_total_human} if s.disk_percent is not None else None,
    }
    if hasattr(s, "uptime_formatted"):
        base["uptime"] = {"formatted": s.uptime_formatted, "seconds": s.uptime_seconds}
        base["system"] = {"hostname": s.system_hostname, "kernel": s.system_kernel, "os": s.system_os}

    load = {}
    for k in ("load_1m", "load_5m", "load_15m"):
        v = getattr(s, k, None)
        if v is not None:
            load[k.split("_")[1]] = v
    if load:
        base["load"] = load

    swap = {}
    for k in ("swap_percent", "swap_used_gib", "swap_total_gib"):
        v = getattr(s, k, None)
        if v is not None:
            swap[k.split("_")[1] if k != "swap_percent" else "percent"] = v
    if swap:
        base["swap"] = swap

    diskio = {}
    for k in ("disk_io_read_mb", "disk_io_write_mb"):
        v = getattr(s, k, None)
        if v is not None:
            diskio["readMb" if "read" in k else "writeMb"] = v
    if diskio:
        base["diskio"] = diskio

    net = {}
    for k in ("net_established", "net_time_wait"):
        v = getattr(s, k, None)
        if v is not None:
            net["established" if "established" in k else "timeWait"] = v
    if net:
        base["netstat"] = net

    docker = {}
    for k in ("docker_running", "docker_total"):
        v = getattr(s, k, None)
        if v is not None:
            docker["running" if "running" in k else "total"] = v
    if hasattr(s, "containers_json") and s.containers_json:
        docker["containers"] = s.containers_json
    if docker:
        base["docker"] = docker

    if hasattr(s, "traffic_json") and s.traffic_json:
        base["traffic"] = s.traffic_json
    if hasattr(s, "top_processes_json") and s.top_processes_json:
        base["processes"] = {"top": s.top_processes_json}

    if hasattr(s, "sshsessions_json") and s.sshsessions_json:
        base["sshsessions"] = s.sshsessions_json

    return base


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

    # fetch previous snapshot for traffic speed delta
    previous = (
        db.query(HostMetricSnapshot)
        .filter(
            HostMetricSnapshot.server_id == server.id,
            HostMetricSnapshot.recorded_at < latest.recorded_at,
        )
        .order_by(desc(HostMetricSnapshot.recorded_at))
        .first()
    )

    result = _snap_to_dict(latest)
    speed = _compute_traffic_speed(latest, previous)
    if speed:
        result["traffic_speed"] = speed
    diskio = _compute_disk_io(latest, previous)
    if diskio:
        if "diskio" not in result:
            result["diskio"] = {}
        result["diskio"].update(diskio)
    result["lastChecked"] = latest.recorded_at.isoformat() if latest.recorded_at else None
    return result


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

    result = []
    prev_snap = None
    for s in snapshots:
        entry = {
            "t": s.recorded_at.isoformat() if s.recorded_at else None,
            "cpu": s.cpu_percent,
            "mem": s.memory_percent,
            "mem_used": s.memory_used_gib,
            "mem_total": s.memory_total_gib,
            "disk": s.disk_percent,
            "disk_used": s.disk_used_human if hasattr(s, "disk_used_human") else None,
            "disk_total": s.disk_total_human if hasattr(s, "disk_total_human") else None,
            "load_1m": getattr(s, "load_1m", None),
            "load_5m": getattr(s, "load_5m", None),
            "load_15m": getattr(s, "load_15m", None),
            "swap": getattr(s, "swap_percent", None),
            "swap_used": getattr(s, "swap_used_gib", None),
            "swap_total": getattr(s, "swap_total_gib", None),
            "diskio_read": getattr(s, "disk_io_read_mb", None),
            "diskio_write": getattr(s, "disk_io_write_mb", None),
            "net_established": getattr(s, "net_established", None),
            "net_time_wait": getattr(s, "net_time_wait", None),
            "docker_running": getattr(s, "docker_running", None),
            "docker_total": getattr(s, "docker_total", None),
        }
        speed = _compute_traffic_speed(s, prev_snap)
        if speed:
            entry["traffic_speed"] = speed
        diskio = _compute_disk_io(s, prev_snap)
        if diskio:
            entry["diskio_speed"] = diskio
        result.append(entry)
        prev_snap = s

    # Fill gaps with null entries so frontend can show gap indicators
    if len(result) > 1:
        interval_map = {
            HostMetricSnapshot: 5,
            HostMetricRollup1m: 60,
            HostMetricRollup5m: 300,
            HostMetricRollup10m: 600,
        }
        expected_interval = interval_map.get(model, 300)
        filled = [result[0]]
        for entry in result[1:]:
            prev_t = datetime.fromisoformat(filled[-1]["t"])
            cur_t = datetime.fromisoformat(entry["t"])
            gap = (cur_t - prev_t).total_seconds()
            if gap > expected_interval * 1.5:
                null_t = prev_t + timedelta(seconds=expected_interval)
                while null_t < cur_t:
                    null_entry = {k: None for k in entry.keys()}
                    null_entry["t"] = null_t.isoformat()
                    filled.append(null_entry)
                    null_t += timedelta(seconds=expected_interval)
            filled.append(entry)
        result = filled

    return result
