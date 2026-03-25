# app/tasks/mission_expiry.py
"""Mark overdue active missions as 'expired'."""

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models import UserMission


def expire_overdue_missions() -> int:
    """Expire all active missions past their expires_at. Returns count expired."""
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        count = (
            db.query(UserMission)
            .filter(
                UserMission.status == "active",
                UserMission.expires_at <= now,
            )
            .update({"status": "expired"}, synchronize_session="fetch")
        )
        db.commit()
        return count
    finally:
        db.close()
