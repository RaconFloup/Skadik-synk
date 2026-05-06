import httpx
from typing import Optional
from app.config import settings
from app.schemas.server import ServerCreate, ServerUpdate


async def create_host(server: ServerCreate) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.TERMIX_URL}/host/db/host",
            headers={
                "Authorization": f"Bearer {settings.TERMIX_JWT_TOKEN}",
                "Content-Type": "application/json"
            },
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
            }
        )
        if response.status_code in (200, 201):
            data = response.json()
            return {"success": True, "host_id": data.get("id")}
        return {"success": False, "error": response.text}


async def update_host(termix_host_id, server: ServerUpdate) -> dict:
    host_id = int(termix_host_id)
    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"{settings.TERMIX_URL}/host/db/host/{host_id}",
            headers={
                "Authorization": f"Bearer {settings.TERMIX_JWT_TOKEN}",
                "Content-Type": "application/json"
            },
            json={
                "name": f"{server.purpose} [{server.country}] {server.hosting}",
                "ip": server.ip,
                "port": server.ssh_port,
                "username": server.ssh_username,
                "authType": "password",
                "password": server.ssh_password,
            }
        )
        if response.status_code == 200:
            return {"success": True}
        return {"success": False, "error": response.text}


async def delete_host(termix_host_id) -> dict:
    host_id = int(termix_host_id)
    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"{settings.TERMIX_URL}/host/db/host/{host_id}",
            headers={
                "Authorization": f"Bearer {settings.TERMIX_JWT_TOKEN}"
            }
        )
        if response.status_code in (200, 204):
            return {"success": True}
        return {"success": False, "error": response.text}
