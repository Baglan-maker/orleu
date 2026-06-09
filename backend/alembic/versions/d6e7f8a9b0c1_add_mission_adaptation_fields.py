"""Add mission adaptation fields (trend_focus, applied_trend, baseline_value)

Revision ID: d6e7f8a9b0c1
Revises: a0b1c2d3e4f5
Create Date: 2026-06-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6e7f8a9b0c1'
down_revision: Union[str, Sequence[str], None] = 'a0b1c2d3e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('mission_templates', sa.Column('trend_focus', sa.String(length=20), nullable=True))
    op.add_column('user_missions', sa.Column('applied_trend', sa.String(length=20), nullable=True))
    op.add_column('user_missions', sa.Column('baseline_value', sa.Float(), nullable=True))

    # Backfill trend_focus for templates seeded before this migration.
    op.execute(
        "UPDATE mission_templates SET trend_focus = 'improving' "
        "WHERE name IN ('Volume Crusher', 'Tonnage King')"
    )
    op.execute(
        "UPDATE mission_templates SET trend_focus = 'plateau' "
        "WHERE name IN ('Exercise Explorer', 'Movement Variety')"
    )
    op.execute(
        "UPDATE mission_templates SET trend_focus = 'declining' "
        "WHERE name IN ('Comeback Session', 'Endurance Block')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_missions', 'baseline_value')
    op.drop_column('user_missions', 'applied_trend')
    op.drop_column('mission_templates', 'trend_focus')
