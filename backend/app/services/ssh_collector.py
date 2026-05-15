import asyncio
import logging
import re
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
    mem = None
    swap = None
    for line in text.strip().split("\n"):
        if line.startswith("Mem:"):
            parts = line.split()
            total = float(parts[1])
            available = float(parts[-1])
            used = total - available
            mem = {
                "percent": round(used / total * 100),
                "usedGiB": round(used / 1024, 2),
                "totalGiB": round(total / 1024, 2),
            }
        if line.startswith("Swap:"):
            parts = line.split()
            stotal = float(parts[1])
            sused = float(parts[2])
            if stotal > 0:
                swap = {
                    "percent": round(sused / stotal * 100),
                    "usedGiB": round(sused / 1024, 2),
                    "totalGiB": round(stotal / 1024, 2),
                }
            else:
                swap = {"percent": 0, "usedGiB": 0, "totalGiB": 0}
    return {"memory": mem, "swap": swap}


def _parse_cpu_proc(text: str) -> dict:
    lines = [l for l in text.strip().split("\n") if l.strip()]
    if len(lines) < 2:
        return None
    fields = lines[0].split()
    if len(fields) < 5 or fields[0] != "cpu":
        return None
    return {
        "ticks": {
            "user": int(fields[1]),
            "nice": int(fields[2]),
            "system": int(fields[3]),
            "idle": int(fields[4]),
        },
        "cores": int(lines[1]),
    }


def _parse_loadavg(text: str) -> Optional[dict]:
    parts = text.strip().split()
    if len(parts) >= 3:
        return {
            "1m": float(parts[0]),
            "5m": float(parts[1]),
            "15m": float(parts[2]),
        }
    return None


def _parse_net_dev(text: str) -> list[dict]:
    interfaces = []
    for line in text.strip().split("\n"):
        if ":" not in line:
            continue
        parts = line.split()
        name = parts[0].rstrip(":")
        rx_bytes = int(parts[1])
        rx_packets = int(parts[2])
        tx_bytes = int(parts[9])
        tx_packets = int(parts[10])
        interfaces.append({
            "name": name,
            "rxBytes": rx_bytes,
            "rxPackets": rx_packets,
            "txBytes": tx_bytes,
            "txPackets": tx_packets,
        })
    return interfaces


def _parse_diskstats(text: str) -> dict:
    reads = 0  # sectors read
    writes = 0  # sectors written
    read_ops = 0
    write_ops = 0
    io_time = 0  # cumulative ms spent doing I/O
    iops_progress = 0  # current in-progress I/Os
    for line in text.strip().split("\n"):
        parts = line.split()
        if len(parts) < 14:
            continue
        name = parts[2]
        if name.startswith(("loop", "ram", "sr")):
            continue
        if name.startswith(("sd", "nvme", "vd", "xvd")):
            reads += int(parts[5])       # field 6
            writes += int(parts[9])      # field 10
            read_ops += int(parts[3])    # field 4
            write_ops += int(parts[7])   # field 8
            io_time += int(parts[12])    # field 13
            iops_progress += int(parts[11])  # field 12
    return {
        "readMb": round(reads * 512 / 1024 / 1024, 2),
        "writeMb": round(writes * 512 / 1024 / 1024, 2),
        "readSectors": reads,
        "writeSectors": writes,
        "readOps": read_ops,
        "writeOps": write_ops,
        "ioTimeMs": io_time,
        "iopsInProgress": iops_progress,
    }


def _parse_ss_s(text: str) -> dict:
    established = 0
    time_wait = 0
    for line in text.strip().split("\n"):
        lower = line.lower()
        if "estab" in lower:
            m = re.search(r"(?:estab|established)\s+(\d+)", lower)
            if m:
                established = int(m.group(1))
        if "timewait" in lower or "time-wait" in lower:
            m = re.search(r"(?:timewait|time-wait)\s+(\d+)", lower)
            if m:
                time_wait = int(m.group(1))
    return {"established": established, "timeWait": time_wait}


def _parse_ps(text: str) -> list[dict]:
    processes = []
    for line in text.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split(maxsplit=4)
        if len(parts) < 5:
            continue
        try:
            float(parts[2])
            processes.append({
                "user": parts[0],
                "cpu": parts[2],
                "mem": parts[3],
                "command": parts[4][:80],
            })
        except (ValueError, IndexError):
            pass
    return processes


def _parse_containers(text: str) -> dict:
    lines = [l for l in text.strip().split("\n") if l.strip()]
    result = {"info": None, "containers": []}
    if not lines:
        return result
    idx = 0
    if "|" in lines[0]:
        parts = lines[0].split("|")
        if len(parts) == 2:
            try:
                result["info"] = {"running": int(parts[0]), "total": int(parts[1])}
            except ValueError:
                pass
        idx = 1
    for line in lines[idx:]:
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        name, status, state = parts[0], parts[1], parts[2]
        health = None
        if "(healthy)" in status.lower():
            health = "healthy"
        elif "(unhealthy)" in status.lower():
            health = "unhealthy"
        elif "(health:" in status.lower():
            health = "starting"
        result["containers"].append({"name": name, "status": status, "state": state, "health": health})
    return result


def _parse_ssh_sessions(text: str) -> Optional[dict]:
    monitor_ip = ""
    who_text = ""
    in_text = ""
    out_text = ""

    for line in text.split("\n"):
        if line.startswith("MONITOR_IP="):
            val = line.split("=", 1)[1].strip()
            if val:
                parts = val.split()
                monitor_ip = parts[0] if parts else ""
        elif line.strip() == "---USERS---":
            who_text = "\n".join(text.split("\n---USERS---\n", 1)[1:]).split("\n---IN---")[0]
        elif line.strip() == "---IN---":
            in_text = "\n".join(text.split("\n---IN---\n", 1)[1:]).split("\n---OUT---")[0]
        elif line.strip() == "---OUT---":
            out_text = "\n".join(text.split("\n---OUT---\n", 1)[1:])

    users = []
    for line in who_text.split("\n"):
        line = line.strip()
        if not line or line.startswith("MONITOR_IP="):
            continue
        cols = line.split()
        if len(cols) < 5:
            continue
        users.append({
            "user": cols[0],
            "terminal": cols[1],
            "host": cols[-1],
        })

    connections = []
    for line in in_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        cols = line.split()
        if len(cols) < 4:
            continue
        peer = cols[3]
        ip = peer.rsplit(":", 1)[0].strip("[]")
        connections.append({"ip": ip, "monitor": ip == monitor_ip, "direction": "in"})

    for line in out_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        cols = line.split()
        if len(cols) < 4:
            continue
        peer = cols[3]
        ip = peer.rsplit(":", 1)[0].strip("[]")
        connections.append({"ip": ip, "monitor": False, "direction": "out"})

    result = {"users": users, "total": len(connections), "connections": connections}
    return result if users or len(connections) > 0 else None


def _filter_ssh_sessions(data: dict) -> Optional[dict]:
    user_ips = {u["host"] for u in data["users"] if u.get("host") and u["host"] != ":0"}
    filtered = [
        c for c in data["connections"]
        if c["direction"] == "out" or c["ip"] in user_ips or c.get("monitor")
    ]
    if not data["users"] and not filtered:
        return None
    data["connections"] = filtered
    data["total"] = len(filtered)
    return data


DEFAULT_HEAVY_INTERVAL = 30
_last_heavy: dict[uuid.UUID, float] = {}

_LIGHT_CMDS = {
    "cpu":      ("cpustat", "head -1 /proc/stat 2>/dev/null; nproc 2>/dev/null"),
    "memory":   ("free", "free -m 2>/dev/null"),
    "disk":     ("df", "df -h / 2>/dev/null"),
    "uptime":   ("uptime", "cat /proc/uptime 2>/dev/null"),
    "system":   ("uname", r"cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME=' | head -1; echo; uname -a 2>/dev/null | head -1"),
    "load":     ("loadavg", "cat /proc/loadavg 2>/dev/null"),
    "diskio":   ("diskstats", "cat /proc/diskstats 2>/dev/null"),
    "traffic":  ("netdev", "cat /proc/net/dev 2>/dev/null"),
}

_HEAVY_CMDS = {
    "netstat":        ("ss", "ss -s 2>/dev/null"),
    "processes":      ("ps", "ps -eo user,pid,%cpu,%mem,comm --sort=-%cpu --no-headers 2>/dev/null | head -20"),
    "containers":     ("containers", r"sudo docker info --format '{{.ContainersRunning}}|{{.Containers}}' 2>/dev/null; echo; sudo docker ps --format '{{.Names}}\t{{.Status}}\t{{.State}}' 2>/dev/null"),
    "sshsessions":    ("sshsessions", "echo MONITOR_IP=$SSH_CLIENT; echo '---USERS---'; who -u 2>/dev/null; echo '---IN---'; ss -tn state established sport = :22 2>/dev/null | tail -n +2; echo '---OUT---'; ss -tn state established dport = :22 2>/dev/null | tail -n +2"),
}


def _build_batch_cmd(keys: list[str]) -> str:
    parts = []
    cmd_map = {}
    cmd_map.update(_LIGHT_CMDS)
    cmd_map.update(_HEAVY_CMDS)
    for key in keys:
        if key in cmd_map:
            parts.append("echo '>>>{}<<<'; {}".format(key, cmd_map[key][1]))
    return " ; ".join(parts)


def _split_batch_output(text: str) -> dict[str, str]:
    outputs = {}
    current_key = None
    current_lines: list[str] = []
    for line in text.split("\n"):
        if line.startswith(">>>") and line.endswith("<<<"):
            if current_key:
                outputs[current_key] = "\n".join(current_lines)
            current_key = line[3:-3]
            current_lines = []
        else:
            current_lines.append(line)
    if current_key:
        outputs[current_key] = "\n".join(current_lines)
    return outputs


async def collect(server: Server, enabled_metrics: Optional[list[str]] = None, heavy_interval: int = DEFAULT_HEAVY_INTERVAL) -> Optional[dict]:
    if enabled_metrics is None:
        enabled_metrics = list(_LIGHT_CMDS.keys()) + list(_HEAVY_CMDS.keys())

    conn = await connection_manager.get(server)
    if conn is None:
        logger.warning("SSH connection failed for %s", server.purpose)
        return None

    now = datetime.utcnow().timestamp()
    last = _last_heavy.get(server.id, 0)
    run_heavy = (now - last) >= heavy_interval
    if run_heavy:
        _last_heavy[server.id] = now

    em = set(enabled_metrics)
    if "docker" in em:
        em.discard("docker")
        em.add("containers")

    light_selected = [k for k in _LIGHT_CMDS if k in em]
    heavy_selected = [k for k in _HEAVY_CMDS if k in em and run_heavy]

    selected = light_selected + heavy_selected
    if not selected:
        return {"lastChecked": datetime.utcnow().isoformat() + "Z"}

    try:
        batch_cmd = _build_batch_cmd(selected)
        r = await conn.run(batch_cmd, timeout=30)
        raw = r.stdout
        outputs = _split_batch_output(raw)

        if not outputs:
            connection_manager.drop(server.id)
            return None

        data: dict = {}

        if "cpu" in outputs:
            data["cpu"] = _parse_cpu_proc(outputs["cpu"])
        if "memory" in outputs:
            parsed = _parse_free_m(outputs["memory"])
            if parsed:
                data["memory"] = parsed["memory"]
                data["swap"] = parsed["swap"]
        if "disk" in outputs:
            data["disk"] = _parse_df(outputs["disk"])
        if "uptime" in outputs:
            data["uptime"] = _parse_uptime(outputs["uptime"])
        if "system" in outputs:
            data["system"] = _parse_uname(outputs["system"])
        if "load" in outputs:
            data["load"] = _parse_loadavg(outputs["load"])
        if "diskio" in outputs:
            data["diskio"] = _parse_diskstats(outputs["diskio"])
        if "traffic" in outputs:
            data["traffic"] = _parse_net_dev(outputs["traffic"])
        if "netstat" in outputs:
            data["netstat"] = _parse_ss_s(outputs["netstat"])
        if "processes" in outputs:
            data["processes"] = _parse_ps(outputs["processes"])
        if "containers" in outputs:
            parsed = _parse_containers(outputs["containers"])
            docker = {}
            if parsed["info"]:
                docker["running"] = parsed["info"]["running"]
                docker["total"] = parsed["info"]["total"]
            containers_list = parsed["containers"]
            if containers_list:
                if "running" not in docker:
                    docker["running"] = sum(1 for c in containers_list if c["state"] == "running")
                    docker["total"] = len(containers_list)
                docker["containers"] = containers_list
            if docker:
                data["docker"] = docker
        if "sshsessions" in outputs:
            parsed = _parse_ssh_sessions(outputs["sshsessions"])
            if parsed:
                parsed = _filter_ssh_sessions(parsed)
                if parsed:
                    data["sshsessions"] = parsed

        data["lastChecked"] = datetime.utcnow().isoformat() + "Z"
        return data
    except (asyncssh.DisconnectError, OSError, asyncio.TimeoutError) as e:
        logger.warning("SSH connection lost for %s: %s", server.purpose, e)
        connection_manager.drop(server.id)
        return None
    except Exception as e:
        logger.warning("SSH collection failed for %s: %s", server.purpose, e)
        return None


def _parse_uname(text: str) -> dict:
    lines = [l for l in text.strip().split("\n") if l.strip()]
    if len(lines) < 2:
        return {"hostname": "", "kernel": "", "os": ""}
    os_name = ""
    if lines[0].startswith("PRETTY_NAME="):
        try:
            os_name = lines[0].split("=", 1)[1].strip('"')
        except (IndexError, ValueError):
            pass
    parts = lines[-1].split()
    if len(parts) < 3:
        return {"hostname": "", "kernel": "", "os": os_name}
    return {
        "hostname": parts[1],
        "kernel": parts[2],
        "os": os_name or parts[0].capitalize(),
    }
