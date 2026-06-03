-- =============================================================================
-- Схемы PostgreSQL для проекта PACS-RIS-Queue
-- =============================================================================
-- Создаётся автоматически при первом запуске docker-compose
-- (монтируется в /docker-entrypoint-initdb.d/).
--
-- Структура:
--   auth   — пользователи системы, роли, JWT
--   queue  — электронная очередь (талончики, события, кабинеты)
--   ris    — RIS: заказы, исследования, протоколы
--   audit  — журнал действий (логирование для ИБ)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION pacs;
CREATE SCHEMA IF NOT EXISTS queue AUTHORIZATION pacs;
CREATE SCHEMA IF NOT EXISTS ris   AUTHORIZATION pacs;
CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION pacs;

COMMENT ON SCHEMA auth  IS 'Пользователи, роли, аутентификация';
COMMENT ON SCHEMA queue IS 'Электронная очередь: талоны, события, кабинеты';
COMMENT ON SCHEMA ris   IS 'RIS: заказы, исследования, протоколы';
COMMENT ON SCHEMA audit IS 'Журнал аудита: действия пользователей и системные события';

-- По умолчанию всё создаётся в схеме public; меняем search_path
-- на уровне БД для удобства разработки (миграции Alembic указывают схему явно).
ALTER DATABASE pacs_ris SET search_path TO auth, queue, ris, audit, public;
