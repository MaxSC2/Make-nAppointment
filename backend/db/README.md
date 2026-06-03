# База данных PACS-RIS-Queue

## Стек

- **PostgreSQL 16** (Alpine, в Docker)
- **SQLAlchemy 2.0** (async, `asyncpg`)
- **Alembic** — миграции
- **Одна БД** `pacs_ris` с **четырьмя схемами**:
  - `auth` — пользователи, роли, refresh-токены
  - `queue` — талоны электронной очереди, кабинеты, пациенты
  - `ris` — заказы, исследования, протоколы, модальности
  - `audit` — журнал действий (append-only)

## Структура

```
db/
├── config.py           # pydantic-settings: читает .env
├── session.py          # async engine + sessionmaker
├── base.py             # DeclarativeBase + миксины
├── security.py         # bcrypt + JWT
├── dependencies.py     # FastAPI Depends (get_db, get_current_user, require_role)
├── init_db.py          # начальные данные (роли, модальности, кабинеты, админ)
├── init/               # SQL, выполняемый при первом старте контейнера
│   ├── 01_schemas.sql  # создание схем
│   └── 02_roles.sql    # роли БД (pacs_migrator, pacs_app)
├── models/             # ORM-модели (по схеме — отдельный файл)
│   ├── auth.py
│   ├── queue.py
│   ├── ris.py
│   └── audit.py
└── schemas/            # Pydantic DTO (request/response)
    ├── auth.py
    ├── queue.py
    └── ris.py

alembic/
├── env.py              # async env с подключением ко всем моделям
└── versions/
    └── 0001_initial.py # начальная миграция (все таблицы)
```

## Быстрый старт

### 1. Поднять PostgreSQL

```bash
docker compose up -d postgres
```

Это создаст контейнер `pacs_ris_postgres` с БД `pacs_ris`, пользователями `pacs` и `pacs_app`, и автоматически выполнит SQL из `db/init/`.

### 2. Накатить миграции

```bash
python -m alembic upgrade head
```

### 3. Инициализировать справочники и админа

```bash
python -m db.init_db
```

Создаёт:

- 4 роли: `admin`, `doctor`, `registrar`, `technician`
- 8 модальностей: CT, MR, DX, US, XA, PT, MG, NM
- 5 кабинетов: 101 (КТ), 102 (МРТ), 103 (Рентген), 104 (УЗИ), 105 (Ангиография)
- Администратора: `admin` / `admin123`

### 4. Запустить сервисы

```bash
uvicorn ris.main:app       --port 8000 --host 0.0.0.0
uvicorn elqueue.main:app   --port 8005 --host 0.0.0.0
```

Или одним скриптом (Windows): `start.bat`

## Подключение к БД

| DSN | Где используется | Права |
|---|---|---|
| `DATABASE_URL` | runtime сервисов (SELECT/INSERT/UPDATE/DELETE) | `pacs` |
| `DATABASE_MIGRATION_URL` | Alembic, init_db | `pacs_migrator` (DDL) |
| `DATABASE_SYNC_URL` | служебные скрипты на psycopg2 | `pacs` |

Все три DSN прописаны в `.env.example`.

## Схема данных (ER-диаграмма)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ auth.users   │←────────│ auth.user_   │────────→│ auth.roles   │
│              │  1   M  │   roles      │  M   1  │              │
└──────┬───────┘         └──────────────┘         └──────────────┘
       │
       │ 1
       ↓
┌──────────────┐         ┌──────────────┐
│ audit.audit_ │         │ auth.refresh_│
│ log          │         │   tokens     │
└──────────────┘         └──────────────┘

┌──────────────┐         ┌──────────────┐
│queue.patients│←────────│ queue.cabinets│
│              │  1   M  │              │
└──────┬───────┘         └──────┬───────┘
       │                        │
       │ 1                      │ 1
       ↓ M                      ↓ M
┌──────────────┐         ┌──────────────┐
│queue.tickets │         │queue.ticket_ │
│              │         │   events     │
└──────┬───────┘         └──────────────┘
       │ order_id (soft ref)
       ↓
┌──────────────┐         ┌──────────────┐
│ ris.orders   │←────────│ ris.modalities│
│              │  M   1  │              │
└──┬───────┬───┘         └──────────────┘
   │       │
   │ 1   1 ↓ M
   │     ┌──────────────┐
   │     │ ris.studies  │
   │     └──────────────┘
   │ 1
   ↓ 0..1
┌──────────────┐
│ ris.protocols│
└──────────────┘
```

## Миграции

### Создать новую миграцию (после изменения моделей)

```bash
python -m alembic revision --autogenerate -m "add phone to patients"
```

Внимание: всегда проверяйте сгенерированный файл перед применением. Alembic хорошо
ловит добавление/удаление колонок и индексов, но иногда ошибается в:

- `server_default` — может дублировать
- переименовании — воспринимает как drop+create
- типах enum — может создать новый тип вместо ALTER

### Применить миграции

```bash
python -m alembic upgrade head           # все
python -m alembic upgrade +1             # на одну вперёд
python -m alembic downgrade -1           # откатить на одну назад
```

### Посмотреть текущую ревизию

```bash
python -m alembic current
python -m alembic history --verbose
```

## Доступ из GUI

```bash
docker compose --profile gui up -d
```

pgAdmin: <http://localhost:5050>
- Email: `admin@pacs.local`
- Password: `admin`
- Сервер: `postgres` (имя контейнера), порт 5432

## Аутентификация

| Эндпоинт | Метод | Описание |
|---|---|---|
| `/api/auth/login` | POST | `{username, password}` → `{access_token, refresh_token}` |
| `/api/auth/refresh` | POST | `{refresh_token}` → новая пара |
| `/api/auth/logout` | POST | `{refresh_token}` → отзыв refresh |
| `/api/auth/me` | GET | Текущий пользователь (нужен access) |

Access-токен живёт `JWT_ACCESS_TTL_MINUTES` (по умолчанию 60), refresh — `JWT_REFRESH_TTL_DAYS` (7).

## Роли и доступ

| Роль | Может |
|---|---|
| `admin` | Всё (включая создание пользователей) |
| `doctor` | Просмотр заказов, создание/подписание протоколов |
| `registrar` | Регистрация пациентов и талонов |
| `technician` | Вызов следующего, завершение приёма |

`is_superuser=True` обходит все проверки ролей.

## Тестовые команды

```bash
# Создать суперпользователя
python -c "
import asyncio
from db.init_db import seed_admin
from db.session import async_session_maker

async def main():
    async with async_session_maker() as db:
        await seed_admin(db)
asyncio.run(main())
"

# Подключиться через psql
docker compose exec postgres psql -U pacs -d pacs_ris
```

## Резервное копирование

```bash
# Бэкап
docker compose exec -T postgres pg_dump -U pacs -Fc pacs_ris > backup.dump

# Восстановление
docker compose exec -T postgres pg_restore -U pacs -d pacs_ris --clean < backup.dump
```
