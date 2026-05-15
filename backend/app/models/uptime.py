import uuid
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class UptimeMonitor(Base):
    __tablename__ = "uptime_monitors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(255), nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    check_interval = Column(Integer, default=60)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UptimeCheck(Base):
    __tablename__ = "uptime_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id = Column(UUID(as_uuid=True), ForeignKey("uptime_monitors.id", ondelete="CASCADE"), nullable=False)
    is_up = Column(Boolean, nullable=False)
    response_time_ms = Column(Integer)
    error = Column(String(500))
    checked_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_uptime_checks_monitor_checked", "monitor_id", "checked_at"),
    )
