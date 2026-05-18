"""add progress counters

Revision ID: b3f9a1c2d4e5
Revises: 59ac63de01e4
Create Date: 2026-03-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3f9a1c2d4e5'
down_revision: Union[str, Sequence[str], None] = '59ac63de01e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_progress',
        sa.Column('total_workouts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('user_progress',
        sa.Column('missions_completed_count', sa.Integer(), nullable=False, server_default='0'))

    # Sync existing users' counters from actual data
    op.execute("""
        UPDATE user_progress up
        SET total_workouts = (
            SELECT COUNT(*) FROM workouts w WHERE w.user_id = up.user_id
        )
    """)
    op.execute("""
        UPDATE user_progress up
        SET missions_completed_count = (
            SELECT COUNT(*) FROM user_missions um
            WHERE um.user_id = up.user_id AND um.status = 'completed'
        )
    """)


def downgrade() -> None:
    op.drop_column('user_progress', 'missions_completed_count')
    op.drop_column('user_progress', 'total_workouts')
