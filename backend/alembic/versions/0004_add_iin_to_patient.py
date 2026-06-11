"""add iin column to queue.patients

Revision ID: 0004
Revises: 0003_source_ticket_number
Create Date: 2026-06-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004"
down_revision: Union[str, None] = "0003_source_ticket_number"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patients",
        sa.Column("iin", sa.String(12), nullable=True, comment="ИИН (12 цифр)"),
        schema="queue",
    )
    op.create_index("ix_patient_iin", "patients", ["iin"], schema="queue")


def downgrade() -> None:
    op.drop_index("ix_patient_iin", table_name="patients", schema="queue")
    op.drop_column("patients", "iin", schema="queue")
