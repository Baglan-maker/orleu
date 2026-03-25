# app/tasks/mission_reset.py
"""Weekly Monday reset: abandon stale active missions so users start fresh."""

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models import UserMission


def weekly_mission_reset() -> int:
    """Abandon active missions that have passed their expires_at. Runs every Monday 00:00 UTC."""
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        count = (
            db.query(UserMission)
            .filter(
                UserMission.status == "active",
                UserMission.expires_at <= now,
            )
            .update({"status": "abandoned"}, synchronize_session="fetch")
        )
        db.commit()
        return count
    finally:
        db.close()
