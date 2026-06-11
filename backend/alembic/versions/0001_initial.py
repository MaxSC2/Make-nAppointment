"""initial schema: auth, queue, ris, audit

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-02 09:30:00
"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ============================================================
    # auth.roles
    # ============================================================
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String(32), unique=True, nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.String(512)),
        schema="auth",
    )

    # ============================================================
    # auth.users
    # ============================================================
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("username", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("email", sa.String(255), unique=True, index=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("is_superuser", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        schema="auth",
    )

    # ============================================================
    # auth.user_roles (M2M)
    # ============================================================
    op.create_table(
        "user_roles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("auth.users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", sa.Integer,
                  sa.ForeignKey("auth.roles.id", ondelete="CASCADE"), primary_key=True),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_role"),
        schema="auth",
    )

    # ============================================================
    # auth.refresh_tokens
    # ============================================================
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False,
                  index=True),
        sa.Column("token_hash", sa.String(255), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        schema="auth",
    )

    # ============================================================
    # queue.cabinets
    # ============================================================
    op.create_table(
        "cabinets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String(8), unique=True, nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("modality", sa.String(8), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        schema="queue",
    )

    # ============================================================
    # queue.patients
    # ============================================================
    op.create_table(
        "patients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("full_name", sa.String(255), nullable=False, index=True),
        sa.Column("policy_number", sa.String(64), nullable=False, index=True),
        sa.Column("birth_date", sa.DateTime),
        sa.Column("phone", sa.String(32)),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        schema="queue",
    )

    # ============================================================
    # queue.tickets
    # ============================================================
    op.create_table(
        "tickets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("ticket_number", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="waiting"),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("queue.patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("cabinet_id", sa.Integer,
                  sa.ForeignKey("queue.cabinets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("order_id", sa.String(64), index=True),
        sa.Column("study_uid", sa.String(128)),
        sa.Column("called_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint("ticket_number", name="uq_ticket_number"),
        sa.CheckConstraint(
            "status IN ('waiting','in_progress','done','cancelled')",
            name="ck_ticket_status",
        ),
        schema="queue",
    )
    op.create_index(
        "ix_ticket_cabinet_status", "tickets",
        ["cabinet_id", "status"], schema="queue",
    )
    op.create_index(
        "ix_ticket_created_at", "tickets",
        ["created_at"], schema="queue",
    )

    # ============================================================
    # queue.ticket_events
    # ============================================================
    op.create_table(
        "ticket_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("ticket_id", sa.Integer,
                  sa.ForeignKey("queue.tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(32), nullable=False),
        sa.Column("from_status", sa.String(16)),
        sa.Column("to_status", sa.String(16)),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("auth.users.id", ondelete="SET NULL")),
        sa.Column("payload", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        schema="queue",
    )
    op.create_index(
        "ix_event_ticket", "ticket_events",
        ["ticket_id", "created_at"], schema="queue",
    )

    # ============================================================
    # ris.modalities
    # ============================================================
    op.create_table(
        "modalities",
        sa.Column("code", sa.String(8), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text),
        schema="ris",
    )

    # ============================================================
    # ris.orders
    # ============================================================
    op.create_table(
        "orders",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("queue.patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("modality", sa.String(8),
                  sa.ForeignKey("ris.modalities.code", ondelete="RESTRICT"), nullable=False),
        sa.Column("study_uid", sa.String(128), nullable=False),
        sa.Column("study_description", sa.Text),
        sa.Column("referring_physician", sa.String(255)),
        sa.Column("status", sa.String(16), nullable=False, server_default="scheduled"),
        sa.Column("priority", sa.String(8), nullable=False, server_default="normal"),
        sa.Column("scheduled_for", sa.DateTime(timezone=True)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("auth.users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint("study_uid", name="uq_order_study_uid"),
        sa.CheckConstraint(
            "status IN ('scheduled','in_progress','completed','cancelled')",
            name="ck_order_status",
        ),
        schema="ris",
    )
    op.create_index("ix_order_status", "orders", ["status"], schema="ris")
    op.create_index("ix_order_patient", "orders", ["patient_id"], schema="ris")
    op.create_index("ix_order_study_uid", "orders", ["study_uid"], schema="ris")

    # ============================================================
    # ris.studies
    # ============================================================
    op.create_table(
        "studies",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("order_id", sa.String(64),
                  sa.ForeignKey("ris.orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("orthanc_id", sa.String(64), nullable=False),
        sa.Column("series_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("instance_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_uploaded", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("uploaded_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("orthanc_id", name="uq_study_orthanc_id"),
        schema="ris",
    )
    op.create_index("ix_study_order", "studies", ["order_id"], schema="ris")

    # ============================================================
    # ris.protocols
    # ============================================================
    op.create_table(
        "protocols",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("order_id", sa.String(64),
                  sa.ForeignKey("ris.orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text, nullable=False, server_default=""),
        sa.Column("impression", sa.Text),
        sa.Column("is_draft", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("signed_at", sa.DateTime(timezone=True)),
        sa.Column("signed_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("auth.users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint("order_id", name="uq_protocol_order"),
        schema="ris",
    )

    # ============================================================
    # audit.audit_log
    # ============================================================
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("auth.users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("resource_type", sa.String(32)),
        sa.Column("resource_id", sa.String(64)),
        sa.Column("ip_address", postgresql.INET),
        sa.Column("user_agent", sa.String(512)),
        sa.Column("extra", postgresql.JSONB),
        sa.Column("ok", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("error", sa.Text),
        schema="audit",
    )
    op.create_index("ix_audit_user", "audit_log", ["user_id", "created_at"], schema="audit")
    op.create_index("ix_audit_action", "audit_log", ["action", "created_at"], schema="audit")
    op.create_index("ix_audit_created_at", "audit_log", ["created_at"], schema="audit")


def downgrade() -> None:
    # Удаляем в обратном порядке зависимостей
    op.drop_table("audit_log", schema="audit")
    op.drop_table("protocols", schema="ris")
    op.drop_table("studies", schema="ris")
    op.drop_table("orders", schema="ris")
    op.drop_table("modalities", schema="ris")
    op.drop_table("ticket_events", schema="queue")
    op.drop_table("tickets", schema="queue")
    op.drop_table("patients", schema="queue")
    op.drop_table("cabinets", schema="queue")
    op.drop_table("refresh_tokens", schema="auth")
    op.drop_table("user_roles", schema="auth")
    op.drop_table("users", schema="auth")
    op.drop_table("roles", schema="auth")
    op.execute("DROP SCHEMA IF EXISTS audit")
    op.execute("DROP SCHEMA IF EXISTS ris")
    op.execute("DROP SCHEMA IF EXISTS queue")
    op.execute("DROP SCHEMA IF EXISTS auth")
