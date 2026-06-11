"""add source_ticket_number to orders

Revision ID: 0003_source_ticket_number
Revises: 0002_smartq_fields
Create Date: 2026-06-10 14:00:00
"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_source_ticket_number"
down_revision: str | None = "0002_smartq_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("source_ticket_number", sa.String(length=32), nullable=True),
        schema="ris",
    )


def downgrade() -> None:
    op.drop_column("orders", "source_ticket_number", schema="ris")
