import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime

from app.database import Base


class NotificationQueue(Base):
    __tablename__ = "notification_queue"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_id = Column(String(255), nullable=False)
    topic_id = Column(String(255), nullable=True)
    text = Column(Text, nullable=False)
    retry_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    next_retry_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
