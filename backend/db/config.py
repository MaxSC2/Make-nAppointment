"""Конфигурация приложения (читается из .env и переменных окружения).

Используется pydantic-settings — строгая типизация, валидация при старте.
Единый экземпляр `settings` импортируется из любого места:

    from db.config import settings
    engine = create_async_engine(settings.database_url)
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Корень проекта (родитель каталога db/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Главный конфиг. Все поля читаются из .env в корне проекта."""

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- PostgreSQL ---
    database_url: str = Field(
        default="postgresql+asyncpg://pacs:pacs_secret@localhost:5432/pacs_ris",
        description="Async DSN приложения (SELECT/INSERT/UPDATE/DELETE)",
    )
    database_migration_url: str = Field(
        default="postgresql+asyncpg://pacs_migrator:pacs_migrator_secret@localhost:5432/pacs_ris",
        description="Async DSN для миграций (DDL: CREATE/ALTER/DROP)",
    )
    database_sync_url: str = Field(
        default="postgresql+psycopg2://pacs:pacs_secret@localhost:5432/pacs_ris",
        description="Sync DSN (Alembic CLI, служебные скрипты)",
    )

    db_echo: bool = Field(
        default=False,
        description="Логировать SQL-запросы (для отладки)",
    )
    db_pool_size: int = Field(default=10, ge=1, le=100)
    db_max_overflow: int = Field(default=20, ge=0, le=100)

    # --- JWT ---
    jwt_secret: str = Field(
        default="change-me-in-production-please-this-is-not-secure-at-all",
        min_length=16,
    )
    jwt_algorithm: str = Field(default="HS256")
    jwt_access_ttl_minutes: int = Field(default=60, ge=1, le=24 * 60)
    jwt_refresh_ttl_days: int = Field(default=7, ge=1, le=365)

    # --- Сервисы ---
    orthanc_url: str = Field(default="http://localhost:8042")
    ris_url: str = Field(default="http://localhost:8000")
    elqueue_url: str = Field(default="http://localhost:8005")
    ris_port: int = Field(default=8000)
    elqueue_port: int = Field(default=8005)

    # --- Начальный администратор (создаётся при init_db) ---
    admin_username: str = Field(default="admin")
    admin_password: str = Field(default="admin123")
    admin_full_name: str = Field(default="Системный администратор")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Синглтон настроек (lru_cache — один экземпляр на процесс)."""
    return Settings()


# Удобный алиас для импорта: `from db.config import settings`
settings = get_settings()
