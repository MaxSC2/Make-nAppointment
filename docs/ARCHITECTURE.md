# Архитектура MedPlatform (PACS-RIS + Электронная очередь)

> 📁 **Путь к активному проекту:** `C:\Projects\ARCHIVE\MedPlatform\`
>
> Это **актуальный git-репозиторий** — пишем код, коммитим и пушим **только здесь**.
> См. также: [`WHERE_TO_WORK.md`](../WHERE_TO_WORK.md) — подробнее о том, какие папки `C:\Projects\` использовать, а какие нельзя.
>
> ⚠️ Не путать с:
> - `C:\Projects\pacs-ris-queue\` — workspace бэкенда другого AI (без git, **нельзя коммитить**)
> - `C:\Projects\MedPlatform\` — устаревшая пустая копия (не трогать)

## 1. Стек технологий

| Компонент | Технология | Версия |
|---|---|---|
| Frontend | React + Vite + TypeScript | React 19, Vite 8, TS 6 |
| Стилизация | Tailwind CSS | v4 |
| Роутинг | React Router | v7 |
| DICOM Viewer | DWV | 0.36.3 |
| Backend | FastAPI (Python) | 3.12+ |
| ASGI-сервер | Uvicorn | — |
| ORM | SQLAlchemy 2 (async) | — |
| Миграции | Alembic | — |
| СУБД | PostgreSQL | 16 |
| PACS | Orthanc | 26.6.0 (HTTP 8042, DICOM 4242) |
| DICOM | pydicom | 2.4+ |
| Аутентификация | JWT (HS256) + bcrypt | — |
| Инфраструктура | Docker Compose | — |

---

## 2. Архитектура системы

```
Браузер (React SPA, :5173)
┌────────────────┬────────────────┬────────────────┐
│ Эл. очередь    │ Панель врача   │ DICOM Viewer   │
│ (QueuePage,    │ (DoctorPage,   │ (DwvViewer +   │
│  Registration) │  Orders)       │  PACS-фасад)   │
└────────┬───────┴────────┬───────┴────────┬───────┘
         │ JWT            │ JWT            │ JWT
         ▼                ▼                ▼
┌──────────────────────────────────────────────────┐
│         Vite proxy (:5173)                       │
│  /elqueue → :8005  /ris → :8000  /api/v1 → :8000 │
└──────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
┌────────────────┐  ┌────────────────────────────────┐
│   elqueue      │  │   RIS (FastAPI :8000)          │
│   :8005        │  │  ┌────────────┬──────────────┐  │
│   FastAPI      │──┤  │ /api/      │ /api/v1/     │  │
│   (очередь)    │  │  │ (workflow) │ (PACS-фасад) │  │
└────────┬───────┘  │  └─────┬──────┴──────┬───────┘  │
         │          │        │             │          │
         │          │        │             │ REST     │
         ▼          ▼        ▼             ▼          ▼
┌─────────────────────────────┐    ┌────────────────────┐
│  PostgreSQL 16 (:5432)      │    │  Orthanc 26.6.0    │
│  схемы:                     │    │  HTTP :8042        │
│   auth (users, roles, JWT)  │    │  DICOM :4242       │
│   queue (tickets, cabinets) │    │  DICOM-web         │
│   ris (orders, protocols)   │    │  /dicom-web/*      │
│   audit (audit_log)         │    │                    │
└─────────────────────────────┘    └────────────────────┘
```

**Принципы:**
- Frontend общается только с RIS и elqueue (через JWT)
- Frontend НЕ знает про Orthanc (PACS скрыт за PACS-фасадом)
- Все DICOM-файлы идут через PACS-фасад `/api/v1/instances/{id}/dicom` (с JWT)
- elqueue вызывает RIS при регистрации пациента

---

## 3. Структура проекта

```
MedPlatform/
├── backend/
│   ├── db/                        # Слой данных
│   │   ├── config.py              # pydantic-settings
│   │   ├── session.py             # async engine
│   │   ├── base.py                # DeclarativeBase
│   │   ├── security.py            # bcrypt + JWT
│   │   ├── dependencies.py        # FastAPI Depends
│   │   ├── error_handlers.py      # глобальные ошибки (RU)
│   │   ├── init_db.py             # начальные данные
│   │   ├── init/                  # SQL для первого старта
│   │   ├── models/                # ORM (auth, queue, ris, audit)
│   │   └── schemas/               # Pydantic DTO
│   ├── alembic/                   # Миграции
│   │   └── versions/0001_initial.py
│   ├── elqueue/                   # Сервис очереди (:8005)
│   │   ├── main.py
│   │   └── routers/
│   │       ├── auth.py            # /api/auth/*
│   │       └── tickets.py         # /api/cabinets, /api/tickets/*
│   ├── ris/                       # Сервис RIS (:8000)
│   │   ├── main.py                # CORS + error handlers
│   │   ├── routers/
│   │   │   ├── auth.py            # re-export из elqueue
│   │   │   ├── orders.py          # /api/orders, /api/orthanc/*
│   │   │   ├── studies.py         # /api/v1/* (PACS-фасад)
│   │   │   └── dicomweb.py        # /dicom/* (DICOMweb прокси)
│   │   └── services/
│   │       └── pacs_facade.py     # бизнес-логика фасада
│   ├── docker-compose.yml         # PostgreSQL + pgAdmin
│   ├── start.bat                  # автозапуск (Windows)
│   ├── generate-test-images.py    # генератор DICOM
│   └── load-test-data.py          # загрузка тестовых данных
│
├── frontend/                      # React SPA (:5173)
│   ├── vite.config.ts             # Vite + Tailwind + proxy
│   └── src/
│       ├── App.tsx                # Router + ProtectedRoute
│       ├── api/
│       │   ├── client.ts          # base + JWT interceptor
│       │   ├── ris.ts             # /api/orders, /api/v1/studies
│       │   └── queue.ts           # /api/tickets, /api/cabinets
│       ├── contexts/AuthContext.tsx  # JWT state + login/logout
│       ├── hooks/
│       │   ├── useAuth.ts         # context hook
│       │   ├── useQueue.ts        # tickets + cabinets
│       │   └── useOrders.ts       # orders
│       ├── components/
│       │   ├── Layout.tsx         # общий каркас
│       │   ├── DwvViewer.tsx      # DICOM-просмотрщик (DWV)
│       │   ├── QueueTable.tsx     # таблица талонов
│       │   ├── OrderCard.tsx      # карточка заказа
│       │   └── StatusBadge.tsx    # статус-бейдж
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── QueuePage.tsx
│       │   ├── RegistrationPage.tsx
│       │   ├── DoctorPage.tsx
│       │   ├── OrdersPage.tsx
│       │   ├── StudiesPage.tsx    # PACS-список
│       │   ├── ViewerPage.tsx     # DWV-обёртка
│       │   └── ProtocolPage.tsx
│       └── types/
│           ├── auth.ts
│           ├── ris.ts             # OrderOut, StudyListItem, ProtocolOut
│           ├── queue.ts
│           └── dwv.d.ts
│
├── docs/
│   ├── ARCHITECTURE.md            # этот файл
│   └── archive/                   # старые версии ТЗ
│
├── backend/
│   ├── README.md                  # backend docs
│   ├── REPORT.md                  # отчёт по практике
│   ├── TZ.md                      # техзадание
│   ├── DEMO_CHECKLIST.md          # чеклист демо
│   └── docs/RIS_vs_PACS.md        # описание RIS/PACS
│
└── frontend/README.md             # boilerplate Vite
```

---

## 4. Роли в команде

| № | Роль | Обязанности |
|---|---|---|
| 1 | Backend Lead | Архитектура, Auth, БД, docker-compose, Orthanc |
| 2 | Backend RIS | Сервис RIS: заказы, статусы, PACS-фасад, DICOMweb |
| 3 | Backend Queue | Сервис очереди: талоны, статусы, интеграция с RIS |
| 4 | Frontend Lead | Vite+React setup, роутинг, layout, shared-компоненты |
| 5 (Макс) | Frontend RIS | RegistrationPage, QueuePage, DoctorPage, OrdersPage, StudiesPage |
| 6 | Frontend PACS | ViewerPage, DwvViewer (DWV) |

---

## 5. Статусы

**Очередь (queue.tickets.status):** `waiting` → `in_progress` → `done`
**Заказы RIS (ris.orders.status):** `scheduled` → `in_progress` → `completed`

**Переходы (state machine):**
- `waiting` → `in_progress` — вызов врача (`POST /api/tickets/next`)
- `in_progress` → `done` — завершение приёма (`POST /api/tickets/{n}/complete`)
- `scheduled` → `in_progress` — открытие заказа (`PATCH /api/orders/{id}/status?status=in_progress`)
- `in_progress` → `completed` — подписание протокола (`POST /api/orders/{id}/protocol/sign`)

---

## 6. Сценарий A (полный цикл)

```
1. /register                  (registrar/admin)
   → POST /api/tickets
   → elqueue создаёт patient + ticket
   → elqueue вызывает RIS → POST /api/orders
   → RIS создаёт order + генерирует StudyInstanceUID
   → RIS отправляет метаданные в Orthanc (C-STORE)

2. /                          (все)
   → GET /api/tickets?cabinet=101
   → отображается талон со статусом waiting

3. /doctor                    (doctor/technician/admin)
   → POST /api/tickets/next { cabinet_code: 101 }
   → статус → in_progress

4. /studies                   (doctor/admin/viewer)
   → GET /api/v1/studies
   → список DICOM в PACS (Orthanc + JOIN к RIS)

5. /viewer/{studyUid}         (doctor/admin/viewer)
   → GET /api/v1/studies/{uid}  — серии + инстансы
   → GET /api/v1/instances/{id}/dicom  (с JWT) — сырой DICOM
   → DWV отображает снимки

6. /protocol/{orderId}        (doctor/admin)
   → PUT /api/orders/{id}/protocol  — текст + impression
   → POST /api/orders/{id}/protocol/sign  — подпись
   → заказ → completed
   → талон → done
```

---

## 7. Аутентификация (JWT)

**Поток:**
1. `POST /api/auth/login` → `{access_token, refresh_token}` (TTL: 1ч / 30д)
2. Все запросы: `Authorization: Bearer <access_token>`
3. Если 401 → `POST /api/auth/refresh` с refresh_token → новый access
4. `POST /api/auth/logout` → отзыв refresh в БД

**Хранение (frontend):** localStorage `mp_access_token`, `mp_refresh_token`, `mp_user`
**Middleware (backend):** `Depends(get_current_user)` — на всех защищённых эндпоинтах
**Роли:** `admin` > `doctor` > `technician` > `registrar` > `viewer`
**RBAC:** `Depends(require_role(RoleCode.DOCTOR, ...))` — на чувствительных операциях

**CORS:** `allow_origins=["*"]` (dev-режим). В проде ограничить конкретными доменами.

---

## 8. PACS-фасад (ключевое архитектурное решение)

**Проблема:** Orthanc предоставляет низкоуровневый REST API (`/studies`, `/instances/{id}/preview` и т.д.). Frontend не должен знать про Orthanc — это протекание абстракции.

**Решение:** PACS-фасад в RIS — FastAPI-роутер `ris/routers/studies.py` с префиксом `/api/v1`:

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/v1/studies` | Список DICOM + JOIN с RIS (orders) и Patient |
| GET | `/api/v1/studies/{study_uid}` | Серии + инстансы |
| GET | `/api/v1/studies/{study_uid}/preview` | PNG первого среза |
| GET | `/api/v1/instances/{id}/preview` | PNG конкретного среза |
| GET | `/api/v1/instances/{id}/dicom-tags` | JSON DICOM-теги |
| GET | `/api/v1/instances/{id}/dicom` | **Сырой DICOM-файл (с JWT, для DWV)** |
| GET | `/api/v1/patients/{patient_id}/studies` | Снимки пациента |
| GET | `/api/v1/orders/{order_id}/dicom` | DICOM по RIS-заказу |

**Бизнес-логика:** `ris/services/pacs_facade.py` — единая точка работы с Orthanc.

**Преимущества:**
- Скрытие Orthanc от frontend
- Единый формат JSON
- Связь с RIS (orders) и Patient через JOIN
- Скрытие ошибок Orthanc (PACS-фасад возвращает человеко-понятные сообщения на русском)
- **Единая точка аутентификации** — все DICOM-запросы идут через RIS с JWT

---

## 9. Безопасность

| Угроза | Защита |
|---|---|
| Анонимный доступ к API | JWT на всех эндпоинтах (кроме `/health`) |
| Скачивание DICOM без авторизации | `/api/v1/instances/{id}/dicom` (PACS-фасад, JWT) |
| DICOMweb без JWT | `Depends(get_current_user)` в `dicomweb.py` |
| Orthanc прокси без JWT | `Depends(get_current_user)` в `orders.py` (`/orthanc/*`) |
| Прямой доступ к Orthanc из браузера | Vite proxy для Orthanc НЕ настроен — только RIS |
| XSS через JSON ответы | FastAPI автоматически экранирует; React экранирует в JSX |
| SQL injection | SQLAlchemy параметризует все запросы |
| Хранение паролей | bcrypt (12 раундов) |

---

## 10. Что реализовано в MVP

✅ Аутентификация (JWT, refresh, logout)
✅ RBAC (4 роли + superuser)
✅ Регистрация пациента (кабинет, ФИО, полис)
✅ Генерация талона (6 hex-символов)
✅ Управление очередью (3 колонки, вызов, завершение)
✅ Создание RIS-заказа при регистрации
✅ Список исследований (DICOM из PACS + JOIN с RIS)
✅ DICOM-просмотрщик (DWV: scroll, window/level, zoom, draw)
✅ Протокол исследования (создание, подпись, отзыв подписи)
✅ Аудит (audit_log для всех значимых действий)
✅ Тестовые данные (4 пациента, 25 DICOM-исследований)

## Что планируется (v1.0)

- DICOM MWL Provider (pynetdicom, порт 11112)
- DICOM MPPS Receiver (pynetdicom, порт 11113)
- HL7 MLLP-сервер (python-hl7, порт 6661)
- Расписание (CRUD + календарь)
- Биллинг (счета, акты)
- WebSocket для очереди (вместо polling)
- Печать протоколов в PDF
- CORS whitelist (вместо `*`)

---

См. также:
- `backend/docs/RIS_vs_PACS.md` — описание RIS/PACS
- `backend/DEMO_CHECKLIST.md` — сценарий демо
- `backend/REPORT.md` — отчёт по практике
