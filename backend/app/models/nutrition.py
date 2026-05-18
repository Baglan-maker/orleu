from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base
from app.models.core import uuid_pk, now_utc


class FoodItem(Base):
    __tablename__ = "food_items"

    id               = uuid_pk()
    name             = Column(String(200), nullable=False)
    brand            = Column(String(100), nullable=True)
    calories_per100g = Column(Float, nullable=False)
    protein_per100g  = Column(Float, nullable=False)
    carbs_per100g    = Column(Float, nullable=False)
    fat_per100g      = Column(Float, nullable=False)
    is_custom        = Column(Boolean, default=False, nullable=False)
    created_by       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    creator        = relationship("User", back_populates="custom_foods")
    nutrition_logs = relationship("NutritionLog", back_populates="food_item")


class NutritionLog(Base):
    __tablename__ = "nutrition_logs"

    id           = uuid_pk()
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date         = Column(Date, nullable=False)
    meal_type    = Column(String(20), nullable=False)  # breakfast|lunch|dinner|snacks
    food_item_id = Column(UUID(as_uuid=True), ForeignKey("food_items.id"), nullable=False)
    quantity_g   = Column(Float, nullable=False)
    calories     = Column(Float, nullable=False)
    protein_g    = Column(Float, nullable=False)
    carbs_g      = Column(Float, nullable=False)
    fat_g        = Column(Float, nullable=False)
    created_at   = now_utc()

    user      = relationship("User", back_populates="nutrition_logs")
    food_item = relationship("FoodItem", back_populates="nutrition_logs")

    __table_args__ = (
        Index("ix_nutrition_logs_user_date", "user_id", "date"),
    )


class UserNutritionGoals(Base):
    __tablename__ = "user_nutrition_goals"

    user_id        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    calories_goal  = Column(Integer, nullable=False, default=2500)
    protein_goal_g = Column(Integer, nullable=False, default=160)
    carbs_goal_g   = Column(Integer, nullable=False, default=300)
    fat_goal_g     = Column(Integer, nullable=False, default=80)
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="nutrition_goals")
