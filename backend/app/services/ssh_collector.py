import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional

import asyncssh

from app.models.server import Server

logger = logging.getLogger(__name__)


class SSHConnectionManager:
    def __init__(self):
        self._connections: dict[uuid.UUID, asyncssh.SSHClientConnection] = {}

    async def get(self, server: Server) -> Optional[asyncssh.SSHClientConnection]:
        sid = server.id
        conn = self._connections.get(sid)
        if conn is not None:
            return conn

        try:
            conn = await asyncio.wait_for(
                asyncssh.connect(
                    server.ip,
                    port=server.ssh_port or 22,
                    username=server.ssh_username,
                    password=server.ssh_password,
                    known_hosts=None,
                    keepalive_interval=10,
                    connect_timeout=10,
                ),
                timeout=10,
            )
            self._connections[sid] = conn
            return conn
        except Exception as e:
            self._connections.pop(sid, None)
            return None

    def drop(self, server_id: uuid.UUID):
        self._connections.pop(server_id, None)

    async def close_all(self):
        for sid, conn in self._connections.items():
            conn.close()
        self._connections.clear()


connection_manager = SSHConnectionManager()


def _parse_uptime(text: str) -> dict:
    secs = float(text.strip().split()[0])
    d = int(secs // 86400)
    h = int((secs % 86400) // 3600)
    m = int((secs % 3600) // 60)
    return {"seconds": secs, "formatted": f"{d}d {h}h {m}m"}


def _parse_df(text: str) -> Optional[dict]:
    for line in text.strip().split("\n"):
        if " /" in line and line.strip().endswith(" /"):
            parts = line.split()
            if len(parts) >= 6:
                return {
                    "percent": int(parts[4].replace("%", "")),
                    "totalHuman": parts[1],
                    "usedHuman": parts[2],
                    "availableHuman": parts[3],
                }
    return None


def _parse_free_m(text: str) -> Optional[dict]:
    for line in text.strip().split("\n"):
        if line.startswith("Mem:"):
            parts = line.split()
            total = float(parts[1])
            available = float(parts[-1])
            used = total - available
            return {
                "percent": round(used / total * 100),
                "usedGiB": round(used / 1024, 2),
                "totalGiB": round(total / 1024, 2),
            }
    return None


def _parse_top_cpu(text: str) -> dict:
    lines = text.strip().split("\n")

    cpu_percent = None
    for line in lines:
        if line.startswith("%Cpu") and "us," in line:
            parts = line.replace(",", " ").split()
            for i, p in enumerate(parts):
                if p in ("id",):
                    try:
                        idle = float(parts[i - 1])
                        cpu_percent = round(100 - idle, 1)
                    except (ValueError, IndexError):
                        pass
                    break

    load_avg = None
    for line in lines:
        if line.startswith("top -") and "load average:" in line:
            la = line.split("load average:")[1].strip()
            load_avg = [float(x.strip().replace(",", ".")) for x in la.split(",")]
            break

    return {"percent": cpu_percent, "load": load_avg}


def _parse_uname(text: str) -> dict:
    parts = text.strip().split()
    if len(parts) < 3:
        return {"hostname": "", "kernel": "", "os": ""}
    return {
        "hostname": parts[1],
        "kernel": parts[2],
        "os": f"{parts[0].capitalize()} (unknown version)",
    }


_CMDS = {
    "cpu":      ("top", "top -bn1 2>/dev/null | head -20"),
    "memory":   ("free", "free -m 2>/dev/null"),
    "disk":     ("df", "df -h / 2>/dev/null"),
    "uptime":   ("uptime", "cat /proc/uptime 2>/dev/null"),
    "system":   ("uname", "uname -a 2>/dev/null | head -1"),
}


async def collect(server: Server, enabled_metrics: Optional[list[str]] = None) -> Optional[dict]:
    if enabled_metrics is None:
        enabled_metrics = list(_CMDS.keys())

    conn = await connection_manager.get(server)
    if conn is None:
        logger.warning("SSH connection failed for %s", server.purpose)
        return None

    selected = [key for key in _CMDS if key in enabled_metrics]
    if not selected:
        return {"lastChecked": datetime.utcnow().isoformat() + "Z"}

    try:
        cmds = [_CMDS[k][1] for k in selected]
        results = await asyncio.gather(
            *[conn.run(cmd, timeout=10) for cmd in cmds],
            return_exceptions=True,
        )

        outputs: dict[str, str] = {}
        errors = []
        for key, r in zip(selected, results):
            if isinstance(r, Exception):
                errors.append(f"{key}: {r}")
                continue
            out = r.stdout.strip()
            if out:
                outputs[key] = out

        if not outputs:
            logger.warning("All SSH commands failed for %s: %s", server.purpose, "; ".join(errors))
            connection_manager.drop(server.id)
            return None

        data: dict = {}

        if "cpu" in outputs:
            data["cpu"] = _parse_top_cpu(outputs["cpu"])
        if "memory" in outputs:
            data["memory"] = _parse_free_m(outputs["memory"])
        if "disk" in outputs:
            data["disk"] = _parse_df(outputs["disk"])
        if "uptime" in outputs:
            data["uptime"] = _parse_uptime(outputs["uptime"])
        if "system" in outputs:
            data["system"] = _parse_uname(outputs["system"])

        data["lastChecked"] = datetime.utcnow().isoformat() + "Z"
        return data
    except (asyncssh.DisconnectError, OSError, asyncio.TimeoutError) as e:
        logger.warning("SSH connection lost for %s: %s", server.purpose, e)
        connection_manager.drop(server.id)
        return None
    except Exception as e:
        logger.warning("SSH collection failed for %s: %s", server.purpose, e)
        return None
