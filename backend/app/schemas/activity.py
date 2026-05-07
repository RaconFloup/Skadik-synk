from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class ActivityCreate(BaseModel):
    text: str
    time: str


class ActivityResponse(BaseModel):
    id: UUID
    text: str
    time: str
    created_at: datetime

    class Config:
        from_attributes = True
