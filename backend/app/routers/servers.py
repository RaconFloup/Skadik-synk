from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.server import Server
from app.schemas.server import ServerCreate, ServerUpdate, ServerResponse
from app.services import termix, google_drive
from datetime import date

router = APIRouter(prefix="/api/servers", tags=["servers"])


async def sync_server_to_services(server: Server):
    if not server.termix_host_id and server.status == "active":
        try:
            termix_result = await termix.create_host(ServerCreate(**{
                "purpose": server.purpose,
                "hosting": server.hosting,
                "country": server.country,
                "ip": server.ip,
                "ssh_port": server.ssh_port,
                "ssh_username": server.ssh_username,
                "ssh_password": server.ssh_password,
                "status": server.status
            }))
            if termix_result.get("success"):
                server.termix_host_id = termix_result.get("host_id")
        except:
            pass

    if not server.google_doc_id:
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
                "cost": str(server.cost) if server.cost else "",
                "currency": server.currency,
                "cycle": server.cycle,
                "created": server.created.strftime("%Y-%m-%d") if server.created else "",
                "next_payment": server.next_payment.strftime("%Y-%m-%d") if server.next_payment else "",
                "notes": server.notes,
                "services": server.services
            })
            if gd_result.get("success"):
                server.google_doc_id = gd_result.get("file_id")
            else:
                print(f"Google Drive error: {gd_result.get('error')}")
        except Exception as e:
            print(f"Google Drive exception: {e}")


@router.get("", response_model=List[ServerResponse])
def get_servers(db: Session = Depends(get_db)):
    return db.query(Server).all()


@router.get("/{server_id}", response_model=ServerResponse)
def get_server(server_id: UUID, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server


@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(server_data: ServerCreate, db: Session = Depends(get_db)):
    server = Server(**server_data.model_dump())
    db.add(server)
    db.commit()
    db.refresh(server)

    await sync_server_to_services(server)

    db.commit()
    db.refresh(server)
    return server


@router.put("/{server_id}", response_model=ServerResponse)
def update_server(server_id: UUID, server_data: ServerUpdate, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    update_data = server_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(server, field, value)

    db.commit()
    db.refresh(server)

    return server


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(server_id: UUID, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    if server.termix_host_id:
        try:
            await termix.delete_host(server.termix_host_id)
        except:
            pass

    if server.google_doc_id:
        try:
            await google_drive.delete_google_doc(server.google_doc_id)
        except:
            pass

    db.delete(server)
    db.commit()
    return None