"""add nutrition_buff_date

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-05-10 13:00:00.000000

Adds nutrition_buff_date on user_progress so the protein-goal-met "buff"
can grant +5% XP on the next day's workout.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, Sequence[str], None] = 'b4c5d6e7f8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_progress',
        sa.Column('nutrition_buff_date', sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('user_progress', 'nutrition_buff_date')
