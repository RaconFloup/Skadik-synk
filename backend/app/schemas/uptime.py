from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class UptimeMonitorCreate(BaseModel):
    server_id: Optional[str] = None
    name: str
    host: str
    port: int = 22
    check_interval: int = 60
    is_active: bool = True


class UptimeMonitorUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    check_interval: Optional[int] = None
    is_active: Optional[bool] = None


class UptimeMonitorResponse(BaseModel):
    id: UUID
    server_id: Optional[UUID] = None
    name: str
    host: str
    port: int
    check_interval: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UptimeCheckResponse(BaseModel):
    id: UUID
    monitor_id: UUID
    is_up: bool
    response_time_ms: Optional[int] = None
    error: Optional[str] = None
    checked_at: datetime

    class Config:
        from_attributes = True


class HourlyStat(BaseModel):
    hour: int
    up: int
    total: int


class DayStat(BaseModel):
    date: str
    up: int
    down: int
    total: int
    avg_response_ms: Optional[float] = None
    hourly: List[HourlyStat] = []


class UptimeMonitorWithStatus(BaseModel):
    monitor: UptimeMonitorResponse
    last_check: Optional[UptimeCheckResponse] = None
    recent_checks: List[UptimeCheckResponse] = []
    uptime_24h: Optional[float] = None
    uptime_7d: Optional[float] = None
    daily_stats: List[DayStat] = []
