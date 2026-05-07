import uuid
from sqlalchemy import Column, String, Integer, Numeric, Date, DateTime, Text, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from app.database import Base


class Server(Base):
    __tablename__ = "servers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purpose = Column(String(50), nullable=False)
    hosting = Column(String(255), nullable=False)
    country = Column(String(50), nullable=False)
    status = Column(String(20), default="active")
    ip = Column(String(45), nullable=False)
    ssh_port = Column(Integer, default=22)
    ssh_username = Column(String(100), nullable=False)
    ssh_password = Column(String(255), nullable=False)
    traffic = Column(String(50))
    cost = Column(Numeric(10, 2))
    currency = Column(String(10), default="USD")
    cycle = Column(String(20), default="monthly")
    created = Column(Date)
    next_payment = Column(Date)
    notes = Column(Text)
    services = Column(JSONB, default={})
    termix_host_id = Column(String(255))
    google_doc_id = Column(String(255))
    needs_sync = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())