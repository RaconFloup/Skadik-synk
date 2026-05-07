from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class HostingCreate(BaseModel):
    name: str
    url: Optional[str] = None
    logo_url: Optional[str] = None
    is_default: bool = False


class HostingUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    logo_url: Optional[str] = None
    is_default: Optional[bool] = None


class HostingResponse(BaseModel):
    id: UUID
    name: str
    url: Optional[str] = None
    logo_url: Optional[str] = None
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True
