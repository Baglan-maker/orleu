"""Simplify personal_records: weight-only, drop estimated_1rm/reps/sets

Revision ID: e1f2a3b4c5d6
Revises: 749d68860a29
Create Date: 2026-03-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = '749d68860a29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # personal_record_history: drop estimated_1rm and reps
    op.drop_column('personal_record_history', 'estimated_1rm')
    op.drop_column('personal_record_history', 'reps')

    # personal_records: drop estimated_1rm, reps, sets, previous_1rm, improvement_pct
    op.drop_column('personal_records', 'estimated_1rm')
    op.drop_column('personal_records', 'reps')
    op.drop_column('personal_records', 'sets')
    op.drop_column('personal_records', 'previous_1rm')
    op.drop_column('personal_records', 'improvement_pct')


def downgrade() -> None:
    # personal_records: restore dropped columns
    op.add_column('personal_records', sa.Column('improvement_pct', sa.Float(), nullable=True))
    op.add_column('personal_records', sa.Column('previous_1rm', sa.Float(), nullable=True))
    op.add_column('personal_records', sa.Column('sets', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('personal_records', sa.Column('reps', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('personal_records', sa.Column('estimated_1rm', sa.Float(), nullable=False, server_default='0'))

    # personal_record_history: restore dropped columns
    op.add_column('personal_record_history', sa.Column('reps', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('personal_record_history', sa.Column('estimated_1rm', sa.Float(), nullable=False, server_default='0'))
