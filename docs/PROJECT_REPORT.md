# Отчёт по проекту MedPlatform (RIS-PACS-Queue)

## 1. Обзор

| Параметр | Значение |
|----------|----------|
| **Путь** | `C:\Projects\ARCHIVE\MedPlatform\` (git, master, 13 коммитов, remote: `Make-nAppointment.git`) |
| **Тип** | Гибрид: Next.js 15 (корень) + Vite 8 (frontend/) + FastAPI × 2 (backend/) |
| **Назначение** | Медицинская ИС: РИС (радиология) + PACS (DICOM) + электронная очередь |
| **Статус** | MVP, все сервисы работают, 12 исследований в Orthanc, 29 пациентов в БД |

## 2. Архитектура

```
┌──────────────────────────────────────────────────────┐
│              БРАУЗЕР — React SPA (Vite :5173)          │
│  /queue, /register, /doctor, /studies, /orders,       │
│  /viewer/:uid, /protocol/:id, /login                  │
├──────────────────────────────────────────────────────┤
│        Next.js 15 (корень) — лендинг + dashboard      │
│  / (landing2) /login /register /doctor /admin /lab    │
├──────────────────────────────────────────────────────┤
│                        Vite Proxy                      │
│  /elqueue/* → :8005  /ris/* → :8000  /dicom → :8042   │
├─────────────┬───────────────────────────┬─────────────┤
│  elqueue    │     RIS (FastAPI)         │   Orthanc   │
│  FastAPI    │     :8000                 │   PACS      │
│  :8005      │                           │   :8042     │
│             │  /api/orders/*            │   HTTP API  │
│  /api/      │  /api/v1/studies/*        │   :4242     │
│  tickets/*  │  /api/v1/instances/*      │   DICOM     │
│  /api/      │  /api/v1/series/*         │             │
│  cabinets   │  /api/v1/patients/*       │             │
│  /api/auth/*│  /dicom/* (DICOMweb)      │             │
└──────┬──────┴──────────┬────────────────┴──────┬──────┘
       │                 │                        │
       └─────────────────┼────────────────────────┘
                         ▼
              ┌─────────────────────┐
              │   PostgreSQL 16      │
              │   БД: pacs_ris      │
              │                     │
              │   auth.users        │
              │   auth.roles        │
              │   auth.user_roles   │
              │   auth.refresh_tokens│
              │   queue.patients    │
              │   queue.tickets     │
              │   queue.ticket_events│
              │   queue.cabinets    │
              │   ris.orders        │
              │   ris.studies       │
              │   ris.protocols     │
              │   ris.modalities    │
              │   audit.audit_log   │
              └─────────────────────┘
```

## 3. Backend (Python 3.14.3, FastAPI)

### 3.1 RIS Service (:8000)

**Файлы:** `backend/ris/main.py`, `routers/`, `services/`

**Роутеры:**

| Роутер | Префикс | Эндпоинты |
|--------|---------|-----------|
| `auth.py` | `/api/auth` | POST login, POST refresh, POST logout, GET me |
| `orders.py` | `/api` | GET/POST orders, GET/PATCH order/{id}, GET/PUT protocol, POST sign, GET modalities, GET studies, GET download, Orthanc proxy |
| `studies.py` | `/api/v1` | GET studies, GET study/{uid}, GET preview, POST link, GET instances, GET dicom-tags, GET dicom file, GET series/instances, GET series/thumbnail, GET study/thumbnail, **GET patients (поиск)**, GET patient/studies, GET order/dicom |
| `dicomweb.py` | `/dicom` | QIDO-RS / WADO-RS / STOW-RS прокси к Orthanc |

**Сервисы:**

- `services/pacs_facade.py` (593 строки) — PACS-фасад:
  - `list_all_studies()` — список всех DICOM-исследований с JOIN к RIS
  - `get_study_with_details()` — детали: серии + инстансы (оптимизировано: 3s→46ms)
  - `get_study_preview()` / `get_instance_preview()` — PNG
  - `get_instance_dicom_file()` — сырой DICOM для DWV
  - `get_series_instances()` / `get_series_thumbnail()` / `get_study_thumbnail()`
  - `get_patient_studies()` / `get_order_dicom()`
  - In-memory кэш `study_uid→orthanc_id` (TTL 60с)
  - Semaphore (8 параллельных) к Orthanc

### 3.2 Elqueue Service (:8005)

**Файлы:** `backend/elqueue/main.py`, `routers/auth.py`, `routers/tickets.py`

| Эндпоинт | Описание |
|----------|----------|
| GET `/api/cabinets` | Список кабинетов |
| GET `/api/tickets` | Талоны (фильтр по кабинету/статусу) |
| POST `/api/tickets` | Регистрация пациента + создание заказа в RIS |
| GET `/api/tickets/{n}` | Статус талона |
| GET `/api/tickets/{n}/events` | Журнал событий |
| POST `/api/tickets/next` | Вызов следующего (FIFO, FOR UPDATE) |
| POST `/api/tickets/{n}/complete` | Завершить приём |

### 3.3 DB Models (SQLAlchemy 2.0.36, async)

**Схема `auth`:**
- `roles` (admin/doctor/registrar/technician)
- `users` (username, email, bcrypt hash, is_superuser)
- `user_roles` (M2M)
- `refresh_tokens` (SHA-256 hash, expires, revocable)

**Схема `queue`:**
- `cabinets` (code, name, modality)
- `patients` (UUID pk, full_name, policy_number, birth_date, phone)
- `tickets` (ticket_number, status: waiting/in_progress/done/cancelled, FK→patient, FK→cabinet, order_id)
- `ticket_events` (event_type, from→to status, actor_id, JSON payload)

**Схема `ris`:**
- `modalities` (CT/MR/DX/US/XA…)
- `orders` (8-hex ID, FK→patient, modality, study_uid, status: scheduled/in_progress/completed/cancelled)
- `studies` (FK→order, orthanc_id, series_count, instance_count, is_uploaded)
- `protocols` (FK→order, body, impression, is_draft, signed_at/by)

**Схема `audit`:**
- `audit_log` (user_id, action, resource_type/id, IP, user_agent, JSONB extra)

### 3.4 Миграции (Alembic)

- `0001_initial` — созданы все таблицы в схемах `auth`, `queue`, `ris`, `audit`

### 3.5 Startup

- `backend/db/init_db.py` — создаёт роли (admin, doctor, registrar, technician), админа (admin:admin123), кабинеты (101:КТ, 102:МРТ, 103:Рентген, 104:УЗИ), модальности (CT, MR, DX, US, XA, MG, PT, NM)

## 4. Frontend (Vite 8 + React 19 + TypeScript 6)

### 4.1 Стек

| Технология | Версия |
|------------|--------|
| React | 19.2.6 |
| Vite | 8.0.12 |
| TypeScript | 6.0.2 |
| Tailwind CSS | 4.3.0 |
| React Router | 7.16.0 |
| DWV (DICOM Viewer) | 0.36.3 |
| Konva | 9.3.20 |

### 4.2 Страницы (11)

| Страница | Маршрут | Описание |
|----------|---------|----------|
| `LoginPage` | `/login` | JWT-логин (admin/admin123) |
| `QueuePage` | `/` | Электронная очередь (все кабинеты/фильтр) |
| `RegistrationPage` | `/register` | Регистрация пациента (registrar/admin) |
| `DoctorPage` | `/doctor` | Кабинет врача (вызов/завершение) |
| `OrdersPage` | `/orders` | Список заказов RIS |
| `StudiesPage` | `/studies` | DICOM-исследования (PACS-фасад) с линковкой |
| `ViewerPage` | `/viewer/:studyUid` | DICOM-просмотрщик (DWV) |
| `ProtocolPage` | `/protocol/:orderId` | Протокол заключения |
| `PatientsPage` | `/patients` | Список пациентов с поиском по ФИО/полису |
| `PatientCardPage` | `/patients/:id` | Карточка пациента: статистика, история исследований, превью снимков |
| `OrderEntryPage` | `/orders/new` | Форма назначения исследования (doctor/technician/admin) |

### 4.3 Компоненты (5)

| Компонент | Описание |
|-----------|----------|
| `Layout` | Хедер, навигация (5 пунктов + Пациенты), аватар, logout |
| `DwvViewer` | DICOM-вьювер: инструменты (Scroll, WindowLevel, ZoomAndPan, Draw), фигуры (Ruler/Circle/Rectangle/FreeHand/Arrow/Angle), серии, file upload, info bar |
| `StatusBadge` | Цветовой индикатор статуса |
| `QueueTable` | Таблица очереди + кнопка "Карта пациента" |
| `OrderCard` | Карточка заказа |

### 4.4 API-клиент

| Модуль | Базовый URL | Функции |
|--------|-------------|---------|
| `client.ts` | `/elqueue/api`, `/ris/api`, `/api/v1` | request, setToken, getToken |
| `queue.ts` | `/elqueue/api` | getCabinets, registerTicket, getTickets, getTicket, getTicketEvents, callNext, completeTicket |
| `ris.ts` | `/ris/api` | getOrders, getOrder, createOrder, updateStatus, getOrderStudies, getProtocol, upsertProtocol, signProtocol, getModalities, getStudies |
| `ris.ts` | `/api/v1` | getStudiesList, linkStudy, **getPatients (поиск)**, **getPatientStudies** |

### 4.5 Types

- `auth.ts` — UserOut, TokenPair, LoginRequest, RefreshRequest
- `queue.ts` — CabinetOut, PatientOut, TicketOut, TicketDetail, TicketEventOut, TicketCreateRequest, NextCallRequest
- `ris.ts` — OrderOut, StudyListItem, StudyOut, ProtocolOut, ModalityOut, PatientStudy
- `dwv.d.ts` — декларации для dwv (PositionEvent, DicomWebLoadOptions)

### 4.6 Vite Proxy

```
/elqueue/*  → http://localhost:8005
/ris/*      → http://localhost:8000
/api/v1/*   → http://localhost:8000
/dicom/*    → http://localhost:8000 (FastAPI, с JWT)
```

## 5. Root Next.js 15 Приложение

**Package:** `medplatform` (Next.js 15, React 19, Tailwind 4, lucide-react)

**Маршруты (App Router):**
- `/` — лендинг (`landing2/`)
- `/login`, `/register` — аутентификация
- `/(patient)/dashboard, appointment, emk, laboratory`
- `/doctor/dashboard, orders, patients...`
- `/admin/dashboard, users, settings...`
- `/lab/queue, orders...`

**Middleware:** RBAC по cookie (role), редирект на `/login` если нет токена

**Состояние:** Частично реализован (моковые данные, заглушки). TODO: подключить к реальному API.

## 6. Инфраструктура

### 6.1 Запущенные сервисы

| Сервис | Порт | Статус |
|--------|------|--------|
| PostgreSQL 16 | 5432 | ✅ |
| Orthanc HTTP API | 8042 | ✅ |
| Orthanc DICOM | 4242 | ✅ |
| RIS (FastAPI) | 8000 | ✅ |
| Elqueue (FastAPI) | 8005 | ✅ |
| Vite dev server | 5173 | ✅ |

### 6.2 Тестовые учётки

| Пользователь | Пароль | Роли |
|-------------|--------|------|
| admin | admin123 | admin |

## 7. Производительность

| Эндпоинт | До оптимизации | После |
|----------|---------------|-------|
| GET /api/v1/studies (list) | ~2-3s (N+1) | 14-35ms warm / 127ms cold |
| GET /api/v1/studies/{uid} (details) | ~3s (N+1 series+instances) | 46-65ms (3 parallel ?expand) |
| QIDO-RS /dicom/studies | — | 26ms (8770 studies) |
| GET series/thumbnail | — | 67ms |
| GET series/instances | — | 20ms |

**Ключевые оптимизации:**
1. `studies/{id}/series?expand` + `studies/{id}/instances?expand` вместо N+1
2. In-memory кэш `study_uid→orthanc_id` (TTL 60с) вместо полного `studies?expand` на каждый запрос
3. Батч-запросы в БД (2 запроса вместо 2×N)
4. Semaphore (8 параллельных запросов к Orthanc)
5. httpx connection pool (singleton)

## 8. Git История (13 коммитов)

```
5137994 feat: PatientsPage + PatientCardPage + /api/v1/patients endpoints
781ab75 feat: patients page, card, api endpoints — work in progress
0cbe953 perf(pacs): cache study_uid map + use ?expand on series (3s -> 46ms)
e3db132 docs: mark active project path in all main docs + add WHERE_TO_WORK.md
447a04e fix(dwv): always set Draw shape on tool change
ad2692d fix(api): import risV1Post in ris.ts
3aeddf6 feat(pacs): link unlinked DICOMs to RIS + UI button for notes
d22f7fc fix(pacs): link RIS orders to Orthanc studies + parallelize facade (25s→0.5s)
2a4d491 docs: rewrite ARCHITECTURE.md and REPORT.md for v2.0
590ae8e fix: PACS facade URL was double-prefixed with /ris/api
d9bad57 fix: code review fixes — types, JWT, CORS, lint cleanup
82760e5 chore: remove PRACTICE_LOG.md from repo, restore .gitignore
7d65624 feat: PACS-RIS-Queue integration — full-stack MVP
363d9d9 feat: initial MedPlatform — all pages from Figma design
```

## 9. Статистика проекта

| Метрика | Значение |
|---------|----------|
| **Всего файлов** | ~180+ |
| **Backend Python** | ~3100+ строк |
| **Frontend TSX/TS** | ~2200+ строк |
| **DB таблиц** | 13 (4 схемы) |
| **DB пациентов** | 29 в queue.patients |
| **DB заказов** | 31 в ris.orders |
| **DICOM-исследований в Orthanc** | 12 |
| **Git коммитов** | 13 |
| **Python зависимостей** | ~20 |
| **NPM пакетов (frontend)** | 189 |

## 10. Известные TODO

1. Исправить `series_count`/`instance_count` в `ris.studies` — всегда 0 (не обновляются после линковки)
2. Переписать `DwvViewer.tsx`: Ellipse, drag-and-drop, PACS search, reset, load timeout, file list, status
3. Убрать кнопку `openInFullViewer` из ViewerPage после переноса фич
4. Подключить Next.js страницы к реальному API
5. Доделать RBAC в middleware (Next.js) — сейчас заглушка
6. Создать OrderEntryPage (из AI_CODER_FULL_CONTEXT.md)
7. Протоколы: все 31 пустые черновики — нужен ввод заключений
