"""
Coach messages API.

GET   /api/coach              — list messages (unread first, latest first)
PATCH /api/coach/{id}/read    — mark a message as read
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import User
from app.models.ml import CoachMessage, MlPrediction
from app.services.dependencies import get_current_user

router = APIRouter()


class CoachMessageOut(BaseModel):
    id:           UUID
    message_text: str
    tone:         str
    trend:        Optional[str] = None
    is_read:      bool
    created_at:   datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=List[CoachMessageOut])
def list_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Latest coach messages for the current user.
    Order: unread first, then by created_at desc.
    Includes the trend from the linked prediction (or null if none).
    """
    rows = (
        db.query(CoachMessage, MlPrediction.trend)
        .outerjoin(MlPrediction, MlPrediction.id == CoachMessage.prediction_id)
        .filter(CoachMessage.user_id == current_user.id)
        .order_by(CoachMessage.is_read.asc(), CoachMessage.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        CoachMessageOut(
            id           = msg.id,
            message_text = msg.message_text,
            tone         = msg.tone,
            trend        = trend,
            is_read      = bool(msg.is_read),
            created_at   = msg.created_at,
        )
        for msg, trend in rows
    ]


@router.patch("/{message_id}/read")
def mark_read(
    message_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = (
        db.query(CoachMessage)
        .filter(
            CoachMessage.id      == message_id,
            CoachMessage.user_id == current_user.id,
        )
        .first()
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if not msg.is_read:
        msg.is_read = True
        db.commit()

    return {"id": str(msg.id), "is_read": True}
