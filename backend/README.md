# Интеграция PACS-RIS + Электронная очередь + DWV (v2.0 — PostgreSQL)

> **Что нового в v2:** SQLite заменён на PostgreSQL 16, добавлены JWT-аутентификация,
> роли пользователей, Alembic-миграции, аудит и нормализованная схема БД.

## Содержание

1. [Архитектура](#архитектура)
2. [Быстрый старт (Windows)](#быстрый-старт-windows)
3. [Ручная установка (Linux/Mac/Windows без Docker)](#ручная-установка)
4. [Структура проекта](#структура-проекта)
5. [API](#api)
6. [Аутентификация и роли](#аутентификация-и-роли)
7. [Документация по БД](./db/README.md)
8. [Технический отчёт](./REPORT.md)
9. [Техзадание](./TZ.md)

---

## Архитектура

```
┌──────────────────────────────────────────────────────────────┐
│                    Браузер (фронт)                            │
│  /         — регистратура         /admin — панель врача      │
│  /login    — вход                 /studies — список снимков  │
└────┬─────────────────────┬────────────────────┬───────────────┘
     │ REST                │ REST               │ REST
     ↓                     ↓                    ↓
┌────────────┐       ┌────────────┐       ┌────────────┐
│  elqueue   │──────→│    RIS     │──────→│  Orthanc   │
│  :8005     │       │   :8000    │       │   :8042    │
│  FastAPI   │       │  FastAPI   │       │   (PACS)   │
└─────┬──────┘       └─────┬──────┘       └────────────┘
      │ asyncpg            │ asyncpg
      └─────────┬──────────┘
                ↓
        ┌───────────────────────────────────────┐
        │       PostgreSQL 16 (Docker)          │
        │       БД: pacs_ris                    │
        │  ├─ schema auth  (users, roles, JWT)  │
        │  ├─ schema queue (tickets, cabinets)  │
        │  ├─ schema ris   (orders, protocols)  │
        │  └─ schema audit (audit_log)          │
        └───────────────────────────────────────┘
```

## Быстрый старт (Windows)

```cmd
git clone <repo>
cd pacs-ris-queue
start.bat
```

`start.bat` автоматически:
1. Установит Python-зависимости
2. Поднимет PostgreSQL в Docker
3. Дождётся готовности БД
4. Накатит миграции Alembic
5. Заполнит справочники и создаст админа
6. Запустит Orthanc, RIS и elqueue

После запуска:

| Сервис | Адрес |
|--------|-------|
| Электронная очередь | <http://localhost:8005> |
| Панель врача | <http://localhost:8005/admin> |
| RIS (список исследований) | <http://localhost:8000/studies> |
| RIS Swagger | <http://localhost:8000/docs> |
| Queue Swagger | <http://localhost:8005/docs> |
| Orthanc Explorer | <http://localhost:8042> |
| pgAdmin (опционально) | <http://localhost:5050> |

**Логин:** `admin` / `admin123`

## Ручная установка

```bash
# 1. PostgreSQL (или запустите контейнер из docker-compose.yml)
docker compose up -d postgres

# 2. Python-зависимости
python -m pip install -r requirements.txt
cp .env.example .env       # отредактируйте под себя

# 3. Миграции
python -m alembic upgrade head

# 4. Начальные данные (роли, модальности, кабинеты, админ)
python -m db.init_db

# 5. PACS — Orthanc (опционально; без него RIS продолжит работать)
#    Скачайте Orthanc.exe и положите в orthanc/Orthanc.exe
cd orthanc && Orthanc.exe orthanc.json

# 6. Сервисы (в отдельных терминалах)
uvicorn ris.main:app       --port 8000 --host 0.0.0.0
uvicorn elqueue.main:app   --port 8005 --host 0.0.0.0

# 7. Тестовые DICOM-данные
python generate-test-images.py
```

## Структура проекта

```
pacs-ris-queue/
├── docker-compose.yml         # PostgreSQL (+ опционально pgAdmin)
├── .env.example               # шаблон переменных окружения
├── requirements.txt
├── start.bat                  # автозапуск всего стека (Windows)
│
├── db/                        # ──── Слой данных ────
│   ├── README.md              # документация по БД
│   ├── config.py              # pydantic-settings
│   ├── session.py             # async engine + sessionmaker
│   ├── base.py                # DeclarativeBase
│   ├── security.py            # bcrypt + JWT
│   ├── dependencies.py        # FastAPI Depends
│   ├── init_db.py             # начальные данные
│   ├── init/                  # SQL для первого старта контейнера
│   ├── models/                # ORM-модели по схемам
│   └── schemas/               # Pydantic DTO
│
├── alembic/                   # ──── Миграции ────
│   ├── alembic.ini
│   ├── env.py                 # async env
│   └── versions/
│       └── 0001_initial.py
│
├── elqueue/                   # ──── Сервис очереди ────
│   ├── main.py
│   ├── routers/
│   │   ├── auth.py
│   │   └── tickets.py
│   └── templates/             # HTML-страницы
│       ├── index.html         # регистратура
│       ├── admin.html         # панель врача
│       └── login.html
│
├── ris/                       # ──── Сервис RIS ────
│   ├── main.py
│   ├── routers/
│   │   ├── auth.py            # re-export из elqueue
│   │   └── orders.py
│   └── templates/
│       ├── studies.html       # список исследований
│       ├── viewer.html        # DICOM-просмотрщик
│       └── protocol.html      # редактор протокола
│
├── orthanc/                   # ──── PACS ────
│   ├── Orthanc.exe
│   └── orthanc.json
│
├── generate-test-images.py    # генератор тестовых DICOM
├── README.md                  # этот файл
├── REPORT.md                  # отчёт по практической
└── TZ.md                      # техническое задание
```

## API

### Электронная очередь (порт 8005)

| Метод | Путь | Описание |
|-------|------|----------|
| GET  | `/api/cabinets` | Список кабинетов |
| GET  | `/api/tickets?cabinet=101` | Талончики (фильтр по кабинету/статусу) |
| POST | `/api/tickets` | Регистрация пациента (создаёт заказ в RIS) |
| GET  | `/api/tickets/{number}` | Статус по номеру талона |
| GET  | `/api/tickets/{number}/events` | Журнал событий |
| POST | `/api/tickets/next` | Вызвать следующего (требует роль doctor/technician) |
| POST | `/api/tickets/{number}/complete` | Завершить приём |

### RIS (порт 8000)

| Метод | Путь | Описание |
|-------|------|----------|
| GET  | `/api/orders` | Список заказов |
| POST | `/api/orders` | Создать заказ (требует авторизацию) |
| GET  | `/api/orders/{id}` | Детали заказа |
| PATCH | `/api/orders/{id}/status?status=in_progress` | Сменить статус |
| GET  | `/api/orders/{id}/studies` | Исследования заказа |
| GET  | `/api/orders/{id}/protocol` | Получить протокол |
| PUT  | `/api/orders/{id}/protocol` | Создать/обновить протокол (только doctor) |
| POST | `/api/orders/{id}/protocol/sign` | Подписать протокол (только doctor) |
| GET  | `/api/modalities` | Справочник модальностей |
| GET  | `/api/studies?modality=CT` | Список исследований |
| *    | `/api/orthanc/{path}` | Прокси к Orthanc (обход CORS) |

### Аутентификация (оба сервиса)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/login` | Логин по `username`/`password` |
| POST | `/api/auth/refresh` | Обновить access по refresh |
| POST | `/api/auth/logout` | Отозвать refresh |
| GET  | `/api/auth/me` | Текущий пользователь |

## Аутентификация и роли

- **JWT (HS256)**, токены в `Authorization: Bearer <token>`
- Refresh-токены хранятся в БД (можно отзывать)
- 4 роли: `admin`, `doctor`, `registrar`, `technician`
- `is_superuser=True` обходит проверки

См. подробности: [`db/README.md`](./db/README.md)

## Миграция с v1 (SQLite)

Если у вас уже есть данные в `elqueue.db` и `ris.db`, напишите скрипт
миграции, который перенесёт их в PostgreSQL. Структура таблиц изменилась
(добавлены `patients`, `cabinets`, `user_roles`, `audit_log`).

## Лицензия

Учебный проект. MIT.
