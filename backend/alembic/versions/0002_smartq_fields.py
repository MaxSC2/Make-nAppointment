"""add source fields to orders (SmartQ integration)

Revision ID: 0002_smartq_fields
Revises: 0001_initial
Create Date: 2026-06-09 14:00:00
"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_smartq_fields"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("source_ticket_id", sa.String(length=64), nullable=True),
        schema="ris",
    )
    op.add_column(
        "orders",
        sa.Column("source_system", sa.String(length=32), nullable=True),
        schema="ris",
    )
    op.add_column(
        "orders",
        sa.Column("smartq_called_at", sa.DateTime(timezone=True), nullable=True),
        schema="ris",
    )
    op.create_index(
        "ix_order_source_ticket",
        "orders",
        ["source_ticket_id"],
        schema="ris",
    )


def downgrade() -> None:
    op.drop_index("ix_order_source_ticket", table_name="orders", schema="ris")
    op.drop_column("orders", "smartq_called_at", schema="ris")
    op.drop_column("orders", "source_system", schema="ris")
    op.drop_column("orders", "source_ticket_id", schema="ris")
