"""Alembic env.py — асинхронная конфигурация для проекта PACS-RIS-Queue.

Ключевые моменты:
1. URL берётся из .env (DATABASE_MIGRATION_URL) — роль с правами на DDL.
2. В MetaData включены ВСЕ модели (Base.metadata) — autogen работает.
3. search_path = auth,queue,ris,audit,public — новые таблицы создаются
   в указанных в моделях схемах.
"""

from __future__ import annotations

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Корень проекта в sys.path (чтобы импорт `db.*` работал)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Импорт моделей — обязательно ДО target_metadata
from db.base import Base  # noqa: E402
from db.config import settings  # noqa: E402
from db.models import auth, queue, ris, audit  # noqa: E402,F401

# Alembic Config
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Подменяем sqlalchemy.url на URL миграции
config.set_main_option("sqlalchemy.url", settings.database_migration_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Генерация SQL-скрипта без подключения (для ревью)."""
    context.configure(
        url=settings.database_migration_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Запуск миграций в переданном подключении."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        compare_type=True,        # отслеживать изменения типов колонок
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Async-подключение к БД и применение миграций."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
