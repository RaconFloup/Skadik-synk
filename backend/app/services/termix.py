import httpx
from typing import Optional
from app.config import settings
from app.schemas.server import ServerCreate, ServerUpdate

_client: Optional[httpx.AsyncClient] = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is not None:
        return _client

    if not settings.TERMIX_USERNAME or not settings.TERMIX_PASSWORD:
        raise Exception("TERMIX_USERNAME or TERMIX_PASSWORD not set")

    client = httpx.AsyncClient(base_url=settings.TERMIX_URL, timeout=15.0)
    try:
        response = await client.post(
            "/users/login",
            json={
                "username": settings.TERMIX_USERNAME,
                "password": settings.TERMIX_PASSWORD,
            },
        )
        if response.status_code != 200:
            await client.aclose()
            raise Exception(f"Login failed: {response.text[:200]}")
        _client = client
        return _client
    except Exception as e:
        await client.aclose()
        raise Exception(f"Termix auth error: {e}")


async def create_host(server: ServerCreate) -> dict:
    try:
        client = await _get_client()
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
                "enableDocker": False,
                "showTerminalInSidebar": True,
                "showFileManagerInSidebar": False,
                "showServerStatsInSidebar": True,
            },
        )
        if response.status_code in (200, 201):
            data = response.json()
            return {"success": True, "host_id": data.get("id")}
        return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def update_host(termix_host_id, server: ServerUpdate) -> dict:
    try:
        client = await _get_client()
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
            },
        )
        if response.status_code == 200:
            return {"success": True}
        return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def delete_host(termix_host_id) -> dict:
    try:
        client = await _get_client()
        host_id = int(termix_host_id)
        response = await client.delete(f"/host/db/host/{host_id}")
        if response.status_code in (200, 204):
            return {"success": True}
        return {"success": False, "error": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}
