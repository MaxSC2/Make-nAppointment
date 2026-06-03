-- =============================================================================
-- Роли и начальные данные PostgreSQL
-- =============================================================================
-- Создаются при первом запуске (idempotent: IF NOT EXISTS).
-- Основной пользователь БД (`pacs`) уже создан через POSTGRES_USER.
-- Здесь — только дополнительные служебные роли для приложения.
-- =============================================================================

-- Роль для миграций (DDL: CREATE/ALTER/DROP)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pacs_migrator') THEN
        CREATE ROLE pacs_migrator LOGIN PASSWORD 'pacs_migrator_secret';
    END IF;
END
$$;
GRANT CONNECT ON DATABASE pacs_ris TO pacs_migrator;
GRANT USAGE, CREATE ON SCHEMA auth, queue, ris, audit TO pacs_migrator;
ALTER ROLE pacs_migrator SET search_path TO auth, queue, ris, audit, public;

-- Роль приложения (DML: SELECT/INSERT/UPDATE/DELETE; никакого DDL)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pacs_app') THEN
        CREATE ROLE pacs_app LOGIN PASSWORD 'pacs_app_secret';
    END IF;
END
$$;
GRANT CONNECT ON DATABASE pacs_ris TO pacs_app;
GRANT USAGE ON SCHEMA auth, queue, ris, audit TO pacs_app;

-- Дефолтные привилегии: всё новое в этих схемах сразу доступно приложению
ALTER DEFAULT PRIVILEGES IN SCHEMA auth, queue, ris, audit
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO pacs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth, queue, ris, audit
    GRANT USAGE, SELECT                    ON SEQUENCES TO pacs_app;

GRANT pacs_app TO pacs;
