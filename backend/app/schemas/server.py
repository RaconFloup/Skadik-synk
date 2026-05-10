from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class ServerBase(BaseModel):
    purpose: str
    hosting: str
    country: str
    status: str = "active"
    ip: str
    ssh_port: int = 22
    ssh_username: str
    ssh_password: str
    traffic: Optional[str] = None
    cost: Optional[float] = None
    currency: str = "USD"
    cycle: str = "monthly"
    created: Optional[date] = None
    next_payment: Optional[date] = None
    notes: Optional[str] = None
    services: Optional[dict] = {}


class ServerCreate(ServerBase):
    pass


class ServerUpdate(ServerBase):
    purpose: Optional[str] = None
    hosting: Optional[str] = None
    country: Optional[str] = None
    status: Optional[str] = None
    ip: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_username: Optional[str] = None
    ssh_password: Optional[str] = None
    traffic: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    cycle: Optional[str] = None
    created: Optional[date] = None
    next_payment: Optional[date] = None
    notes: Optional[str] = None
    services: Optional[dict] = None
    not_renewing: Optional[bool] = None
    last_paid_at: Optional[date] = None


class ServerResponse(ServerBase):
    id: UUID
    termix_host_id: Optional[str] = None
    google_doc_id: Optional[str] = None
    needs_sync: bool = True
    not_renewing: bool = False
    last_paid_at: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True