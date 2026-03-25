"""add campaign baseline counters

Revision ID: d5f6a7b8c9d0
Revises: c4e5f6a7b8c9
Create Date: 2026-03-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5f6a7b8c9d0'
down_revision: Union[str, None] = 'c4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_progress',
        sa.Column('campaign_started_workouts', sa.Integer(), nullable=False, server_default='0')
    )
    op.add_column('user_progress',
        sa.Column('campaign_started_missions', sa.Integer(), nullable=False, server_default='0')
    )


def downgrade() -> None:
    op.drop_column('user_progress', 'campaign_started_missions')
    op.drop_column('user_progress', 'campaign_started_workouts')
