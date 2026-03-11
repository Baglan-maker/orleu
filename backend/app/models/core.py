# app/models/core.py
import uuid
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

def uuid_pk():
    """Shortcut: UUID primary key with server-side default."""
    return Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

def now_utc():
    return Column(DateTime(timezone=True), server_default=func.now())