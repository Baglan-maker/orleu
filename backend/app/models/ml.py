# app/models/ml.py
from sqlalchemy import Boolean, Column, Date, Float, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.models.core import uuid_pk, now_utc

class MlPrediction(Base):
    __tablename__ = "ml_predictions"
    __table_args__ = (UniqueConstraint("user_id", "prediction_date"),)

    id              = uuid_pk()
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_date = Column(Date, nullable=False)
    trend           = Column(String(20), nullable=False)
    confidence      = Column(Float,      nullable=False)
    features_json   = Column(JSON)
    shap_values     = Column(JSON)
    model_version   = Column(String(20), nullable=False)
    created_at      = now_utc()

    user     = relationship("User",         back_populates="predictions")
    messages = relationship("CoachMessage", back_populates="prediction")


class CoachMessage(Base):
    __tablename__ = "coach_messages"

    id            = uuid_pk()
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id",         ondelete="CASCADE"), nullable=False, index=True)
    prediction_id = Column(UUID(as_uuid=True), ForeignKey("ml_predictions.id"), nullable=True)
    message_text  = Column(Text, nullable=False)
    tone          = Column(String(20), nullable=False)
    is_read       = Column(Boolean, default=False)
    created_at    = now_utc()

    user       = relationship("User",         back_populates="coach_messages")
    prediction = relationship("MlPrediction", back_populates="messages")