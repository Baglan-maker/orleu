"""add nutrition tables

Revision ID: c4e5f6a7b8c9
Revises: b3f9a1c2d4e5
Create Date: 2026-03-25 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'b3f9a1c2d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # food_items
    op.create_table(
        'food_items',
        sa.Column('id',               postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name',             sa.String(200), nullable=False),
        sa.Column('brand',            sa.String(100), nullable=True),
        sa.Column('calories_per100g', sa.Float(), nullable=False),
        sa.Column('protein_per100g',  sa.Float(), nullable=False),
        sa.Column('carbs_per100g',    sa.Float(), nullable=False),
        sa.Column('fat_per100g',      sa.Float(), nullable=False),
        sa.Column('is_custom',        sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_by',       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_food_items_name', 'food_items', [sa.text('lower(name)')])

    # nutrition_logs
    op.create_table(
        'nutrition_logs',
        sa.Column('id',           postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id',      postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date',         sa.Date(), nullable=False),
        sa.Column('meal_type',    sa.String(20), nullable=False),
        sa.Column('food_item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('food_items.id'), nullable=False),
        sa.Column('quantity_g',   sa.Float(), nullable=False),
        sa.Column('calories',     sa.Float(), nullable=False),
        sa.Column('protein_g',    sa.Float(), nullable=False),
        sa.Column('carbs_g',      sa.Float(), nullable=False),
        sa.Column('fat_g',        sa.Float(), nullable=False),
        sa.Column('created_at',   sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_nutrition_logs_user_date', 'nutrition_logs', ['user_id', 'date'])

    # user_nutrition_goals
    op.create_table(
        'user_nutrition_goals',
        sa.Column('user_id',        postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('calories_goal',  sa.Integer(), nullable=False, server_default='2500'),
        sa.Column('protein_goal_g', sa.Integer(), nullable=False, server_default='160'),
        sa.Column('carbs_goal_g',   sa.Integer(), nullable=False, server_default='300'),
        sa.Column('fat_goal_g',     sa.Integer(), nullable=False, server_default='80'),
        sa.Column('updated_at',     sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('user_nutrition_goals')
    op.drop_index('ix_nutrition_logs_user_date', table_name='nutrition_logs')
    op.drop_table('nutrition_logs')
    op.drop_index('ix_food_items_name', table_name='food_items')
    op.drop_table('food_items')
