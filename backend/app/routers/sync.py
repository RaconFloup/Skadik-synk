from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.models.server import Server
from app.schemas.server import ServerCreate
from app.services import termix, google_drive
from datetime import date

router = APIRouter(prefix="/api/servers", tags=["sync"])


@router.post("/{server_id}/sync")
async def sync_all(server_id: UUID, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    results = {"termix": None, "google_drive": None}

    if server.status == "active" and not server.termix_host_id:
        try:
            termix_result = await termix.create_host(ServerCreate(**{
                "purpose": server.purpose,
                "hosting": server.hosting,
                "country": server.country,
                "ip": server.ip,
                "ssh_port": server.ssh_port,
                "ssh_username": server.ssh_username,
                "ssh_password": server.ssh_password
            }))
            if termix_result.get("success"):
                server.termix_host_id = termix_result.get("host_id")
            results["termix"] = termix_result
        except Exception as e:
            results["termix"] = {"success": False, "error": str(e)}

    if server.next_payment and not server.google_doc_id:
        try:
            gd_result = await google_drive.create_google_doc({
                "purpose": server.purpose,
                "country": server.country,
                "hosting": server.hosting,
                "ip": server.ip,
                "ssh_port": server.ssh_port,
                "ssh_username": server.ssh_username,
                "ssh_password": server.ssh_password,
                "traffic": server.traffic,
                "cost": str(server.cost),
                "currency": server.currency,
                "cycle": server.cycle,
                "created": server.created.strftime("%Y-%m-%d") if server.created else "",
                "next_payment": server.next_payment.strftime("%Y-%m-%d") if server.next_payment else "",
                "notes": server.notes,
                "services": server.services
            })
            if gd_result.get("success"):
                server.google_doc_id = gd_result.get("file_id")
            results["google_drive"] = gd_result
        except Exception as e:
            results["google_drive"] = {"success": False, "error": str(e)}

    db.commit()

    return results


@router.post("/{server_id}/sync-termix")
async def sync_termix(server_id: UUID, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    if server.termix_host_id:
        return {"success": True, "host_id": server.termix_host_id, "message": "already exists"}

    try:
        result = await termix.create_host(ServerCreate(**{
            "purpose": server.purpose,
            "hosting": server.hosting,
            "country": server.country,
            "ip": server.ip,
            "ssh_port": server.ssh_port,
            "ssh_username": server.ssh_username,
            "ssh_password": server.ssh_password
        }))
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/{server_id}/sync-gdrive")
async def sync_gdrive(server_id: UUID, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    if not server.next_payment:
        raise HTTPException(status_code=400, detail="next_payment not set")

    if server.google_doc_id:
        try:
            result = await google_drive.update_google_doc(server.google_doc_id, {
                "purpose": server.purpose,
                "country": server.country,
                "hosting": server.hosting,
                "ip": server.ip,
                "ssh_port": server.ssh_port,
                "ssh_username": server.ssh_username,
                "ssh_password": server.ssh_password,
                "traffic": server.traffic,
                "cost": str(server.cost),
                "currency": server.currency,
                "cycle": server.cycle,
                "created": server.created.strftime("%Y-%m-%d") if server.created else "",
                "next_payment": server.next_payment.strftime("%Y-%m-%d") if server.next_payment else "",
                "notes": server.notes,
                "services": server.services
            })
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}

    try:
        result = await google_drive.create_google_doc({
            "purpose": server.purpose,
            "country": server.country,
            "hosting": server.hosting,
            "ip": server.ip,
            "ssh_port": server.ssh_port,
            "ssh_username": server.ssh_username,
            "ssh_password": server.ssh_password,
            "traffic": server.traffic,
            "cost": str(server.cost),
            "currency": server.currency,
            "cycle": server.cycle,
            "created": server.created.strftime("%Y-%m-%d") if server.created else "",
            "next_payment": server.next_payment.strftime("%Y-%m-%d") if server.next_payment else "",
            "notes": server.notes,
            "services": server.services
        })
        if result.get("success"):
            server.google_doc_id = result.get("file_id")
            db.commit()
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}