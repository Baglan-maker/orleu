"""add achievement_rarity

Revision ID: a0b1c2d3e4f5
Revises: f2a3b4c5d6e7
Create Date: 2026-05-16 10:00:00.000000

Adds rarity column to achievements table for cosmetic distinction.
Rarity values: common, rare, epic
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a0b1c2d3e4f5'
down_revision: Union[str, Sequence[str], None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'achievements',
        sa.Column('rarity', sa.String(20), nullable=False, server_default='common'),
    )


def downgrade() -> None:
    op.drop_column('achievements', 'rarity')
