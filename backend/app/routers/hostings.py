from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.hosting import Hosting
from app.schemas.hosting import HostingCreate, HostingUpdate, HostingResponse

router = APIRouter(prefix="/api/hostings", tags=["hostings"])


@router.get("", response_model=List[HostingResponse])
def get_hostings(db: Session = Depends(get_db)):
    return db.query(Hosting).order_by(Hosting.created_at.asc()).all()


@router.post("", response_model=HostingResponse, status_code=status.HTTP_201_CREATED)
def create_hosting(data: HostingCreate, db: Session = Depends(get_db)):
    existing = db.query(Hosting).filter(Hosting.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Hosting with this name already exists")
    hosting = Hosting(name=data.name, url=data.url, logo_url=data.logo_url, is_default=data.is_default)
    db.add(hosting)
    db.commit()
    db.refresh(hosting)
    return hosting


@router.put("/{hosting_id}", response_model=HostingResponse)
def update_hosting(hosting_id: UUID, data: HostingUpdate, db: Session = Depends(get_db)):
    hosting = db.query(Hosting).filter(Hosting.id == hosting_id).first()
    if not hosting:
        raise HTTPException(status_code=404, detail="Hosting not found")
    if data.name is not None:
        dup = db.query(Hosting).filter(Hosting.name == data.name, Hosting.id != hosting_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="Hosting with this name already exists")
        hosting.name = data.name
    if data.url is not None:
        hosting.url = data.url
    if data.logo_url is not None:
        hosting.logo_url = data.logo_url
    if data.is_default is not None:
        if data.is_default:
            db.query(Hosting).filter(Hosting.is_default == True).update({"is_default": False})
        hosting.is_default = data.is_default
    db.commit()
    db.refresh(hosting)
    return hosting


@router.delete("/{hosting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hosting(hosting_id: UUID, db: Session = Depends(get_db)):
    hosting = db.query(Hosting).filter(Hosting.id == hosting_id).first()
    if not hosting:
        raise HTTPException(status_code=404, detail="Hosting not found")
    db.delete(hosting)
    db.commit()
    return None
