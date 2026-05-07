from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.activity import ActivityLog
from app.schemas.activity import ActivityCreate, ActivityResponse

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("", response_model=List[ActivityResponse])
def get_activities(db: Session = Depends(get_db)):
    return db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(50).all()


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(data: ActivityCreate, db: Session = Depends(get_db)):
    activity = ActivityLog(text=data.text, time=data.time)
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: UUID, db: Session = Depends(get_db)):
    activity = db.query(ActivityLog).filter(ActivityLog.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    db.delete(activity)
    db.commit()
    return None
