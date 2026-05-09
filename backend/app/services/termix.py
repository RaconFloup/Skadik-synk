import httpx
from typing import Optional
from sqlalchemy.orm import Session
from app.models.setting import AppSetting
from app.schemas.server import ServerCreate, ServerUpdate


def _read_settings(db: Session) -> dict:
    rows = db.query(AppSetting).filter(
        AppSetting.key.in_(["termix_url", "termix_username", "termix_password"])
    ).all()
    result = {row.key: row.value for row in rows}
    return result


async def _get_client(db: Session) -> httpx.AsyncClient:
    s = _read_settings(db)
    url = s.get("termix_url", "")
    username = s.get("termix_username", "")
    password = s.get("termix_password", "")

    if not username or not password:
        raise Exception("TERMIX_USERNAME or TERMIX_PASSWORD not set")

    client = httpx.AsyncClient(base_url=url, timeout=15.0)
    try:
        response = await client.post(
            "/users/login",
            json={"username": username, "password": password},
        )
        if response.status_code != 200:
            await client.aclose()
            raise Exception(f"Login failed: {response.text[:200]}")
        return client
    except Exception as e:
        await client.aclose()
        raise Exception(f"Termix auth error: {e}")


async def create_host(server: ServerCreate, db: Session) -> dict:
    try:
        client = await _get_client(db)
        response = await client.post(
            "/host/db/host",
            json={
                "name": f"{server.purpose} [{server.country}] {server.hosting}",
                "ip": server.ip,
                "port": server.ssh_port,
                "username": server.ssh_username,
                "authType": "password",
                "password": server.ssh_password,
                "enableTerminal": True,
                "enableFileManager": True,
                "enableDocker": True,
                "showTerminalInSidebar": True,
                "showFileManagerInSidebar": False,
                "showServerStatsInSidebar": True,
            },
        )
        await client.aclose()
        if response.status_code in (200, 201):
            data = response.json()
            return {"success": True, "host_id": data.get("id")}
        return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def update_host(termix_host_id, server: ServerUpdate, db: Session) -> dict:
    try:
        client = await _get_client(db)
        host_id = int(termix_host_id)
        response = await client.put(
            f"/host/db/host/{host_id}",
            json={
                "name": f"{server.purpose} [{server.country}] {server.hosting}",
                "ip": server.ip,
                "port": server.ssh_port,
                "username": server.ssh_username,
                "authType": "password",
                "password": server.ssh_password,
                "enableDocker": True,
                "enableTerminal": True,
                "enableFileManager": True,
            },
        )
        await client.aclose()
        if response.status_code == 200:
            return {"success": True}
        return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def delete_host(termix_host_id, db: Session) -> dict:
    try:
        s = _read_settings(db)
        url = s.get("termix_url", "")
        async with httpx.AsyncClient(base_url=url, timeout=15.0) as client:
            host_id = int(termix_host_id)
            response = await client.delete(f"/host/db/host/{host_id}")
            if response.status_code in (200, 204):
                return {"success": True}
            return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}
