"""Пакет db — общий слой работы с PostgreSQL.

Структура:
    db.config         — настройки (pydantic-settings, читает .env)
    db.session        — async engine + sessionmaker
    db.base           — DeclarativeBase + миксины
    db.models.*       — ORM-модели (auth, queue, ris, audit)
    db.schemas.*      — Pydantic DTO (request/response)
    db.security       — JWT, хеширование паролей
    db.dependencies   — FastAPI Depends (get_db, get_current_user, ...)
    db.init_db        — начальные данные (роли, админ)
"""
