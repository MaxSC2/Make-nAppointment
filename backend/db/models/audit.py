"""Модели аудита (схема `audit`).

Append-only журнал действий пользователей и системных событий.
Партиционирование по дате — задаётся отдельной миграцией (для проднагрузки).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class AuditAction(str, Enum):
    # Auth
    LOGIN = "auth.login"
    LOGOUT = "auth.logout"
    LOGIN_FAILED = "auth.login_failed"
    TOKEN_REFRESH = "auth.token_refresh"

    # Queue
    TICKET_CREATED = "queue.ticket_created"
    TICKET_CALLED = "queue.ticket_called"
    TICKET_COMPLETED = "queue.ticket_completed"
    TICKET_CANCELLED = "queue.ticket_cancelled"

    # RIS
    ORDER_CREATED = "ris.order_created"
    ORDER_STATUS_CHANGED = "ris.order_status_changed"
    PROTOCOL_UPDATED = "ris.protocol_updated"
    PROTOCOL_SIGNED = "ris.protocol_signed"

    # PACS
    STUDY_UPLOADED = "pacs.study_uploaded"
    STUDY_VIEWED = "pacs.study_viewed"
    STUDY_DOWNLOADED = "pacs.study_downloaded"


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_user", "user_id", "created_at"),
        Index("ix_audit_action", "action", "created_at"),
        Index("ix_audit_created_at", "created_at"),
        {"schema": "audit"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="SET NULL"),
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(32))   # "ticket", "order", …
    resource_id: Mapped[str | None] = mapped_column(String(64))
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(512))
    extra: Mapped[dict | None] = mapped_column(JSONB)   # произвольный контекст
    ok: Mapped[bool] = mapped_column(default=True, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
