# ОТЧЁТ О ПРАКТИЧЕСКОЙ РАБОТЕ

> 📁 **Активный проект:** `C:\Projects\ARCHIVE\MedPlatform\` (git-репо)
> См. [`WHERE_TO_WORK.md`](../WHERE_TO_WORK.md) — куда писать код и коммитить.

**Тема:** Интеграция PACS-RIS с модулем электронной очереди
**Шифр:** ПРАКТИКА-2026-01
**Дата:** 01.06.2026
**Руководитель:** _______________
**Исполнители:** Группа из 6 человек

---

## ВВЕДЕНИЕ

Целью данной практической работы является разработка программного комплекса для автоматизации процесса организации и проведения лучевых исследований в медицинском учреждении. Комплекс объединяет три ключевых компонента:

1. **Электронная очередь** — система регистрации пациентов и управления потоками
2. **RIS** (Radiology Information System) — система управления заказами на исследования
3. **PACS** (Picture Archiving and Communication System) — архив медицинских изображений на базе Orthanc

Актуальность работы обусловлена необходимостью цифровизации медицинских учреждений, замены бумажных журналов электронными системами, сокращения времени ожидания пациентов и централизованного хранения медицинских изображений.

**v2.0 (текущая версия):** в отличие от первой итерации на SQLite, система переведена на PostgreSQL 16, добавлены JWT-аутентификация, роли пользователей, Alembic-миграции, аудит и нормализованная схема БД. Подробное описание v2.0 — в разделах 2.2, 3.1, 4.

---

## ГЛАВА 1. АНАЛИЗ ПРЕДМЕТНОЙ ОБЛАСТИ

### 1.1. Стандарт DICOM

DICOM (Digital Imaging and Communications in Medicine) — международный стандарт хранения, передачи и обработки медицинских изображений. Ключевые характеристики:

- **Формат файла:** один DICOM-файл содержит графическую информацию (изображение) и метаданные (ФИО пациента, дата, тип исследования, параметры съёмки)
- **Модальности:** CT (компьютерная томография — серия срезов), MR (магнитно-резонансная томография), DX (рентген), US (ультразвук), и др.
- **Сжатие:** Lossy JPEG, JPEG2000, Lossless JPEG
- **Сетевые протоколы:** C-STORE (отправка), C-FIND (поиск), C-MOVE (запрос), C-GET (скачивание)
- **DICOMweb:** RESTful-версия протокола (WADO-RS, QIDO-RS, STOW-RS)

### 1.2. Архитектура PACS-RIS

В реальных медицинских учреждениях используются следующие системы:

- **PACS** — долговременное хранилище DICOM-изображений. Обеспечивает приём от аппаратов (C-STORE), хранение, поиск и выдачу изображений по запросу
- **RIS** — информационная система радиологического отделения. Ведёт заказы, расписание, протоколы. Передаёт метаданные в PACS
- **HIS** (Hospital Information System) — больничная информационная система верхнего уровня

В данной работе реализуется упрощённый аналог RIS с интеграцией через REST API (в реальных системах используется HL7 v2.x).

### 1.3. Обзор существующих решений

| Решение | Тип | Лицензия | Особенности |
|---------|-----|----------|-------------|
| Orthanc | PACS | GPLv3 | Легковесный, REST API, встроенный DICOMweb, Windows/Linux |
| DWV | Viewer | AGPL | JavaScript, работа в браузере, поддержка DICOMweb |
| OHIF Viewer | Viewer | MIT | Современный, поддерживает DICOMweb |
| Conquest | PACS | Freeware | Требует настройки DICOM-протоколов |
| DCM4CHEE | PACS | LGPL | Полнофункциональный, сложный в настройке |

Выбор Orthanc обусловлен простотой установки (один exe-файл), наличием REST API, встроенного DICOMweb и веб-интерфейса. DWV выбран как лёгкий встраиваемый вьюер для браузера.

---

## ГЛАВА 2. ТЕХНИЧЕСКОЕ ЗАДАНИЕ

### 2.1. Функциональные требования

**Модуль электронной очереди (F1):**
- F1.1 Регистрация пациента (ФИО, полис, кабинет) с выдачей талона
- F1.2 Генерация 6-символьного hex-номера талона
- F1.3 Отображение очереди с фильтрацией по кабинету
- F1.4 Три колонки: на приёме / ожидают / завершённые
- F1.5 Панель врача: вызов следующего, завершение приёма
- F1.6 Создание RIS-заказа при регистрации (cross-service integration)
- F1.7 Аудит всех значимых действий (auth, queue, order)

**Модуль RIS (F2):**
- F2.1 Создание заказов на исследования с генерацией DICOM StudyInstanceUID
- F2.2 Хранение заказов в PostgreSQL (схема `ris`)
- F2.3 Передача метаданных в Orthanc (best-effort)
- F2.4 Статусы: `scheduled` → `in_progress` → `completed`
- F2.5 Управление протоколом: создание, подписание (отзыв подписи при редактировании)
- F2.6 Справочник модальностей (CT, MR, DX, US)
- F2.7 Прокси к Orthanc (обход CORS, JWT)
- F2.8 DICOMweb-прокси (QIDO-RS, WADO-RS, STOW-RS)

**Модуль PACS-фасада (F2.9):**
- F2.9.1 Список DICOM-исследований с JOIN к RIS-заказам и пациентам
- F2.9.2 Детальная информация по study (серии, инстансы, RIS order, patient)
- F2.9.3 Превью срезов (PNG)
- F2.9.4 Сырой DICOM-файл (для DWV-просмотрщика, с JWT)
- F2.9.5 DICOM-теги (MainDicomTags)
- F2.9.6 Снимки пациента по внутреннему ID
- F2.9.7 DICOM-данные по RIS-заказу

**Модуль просмотра изображений (F3):**
- F3.1 Список исследований с фильтрацией по модальности
- F3.2 Загрузка снимков из PACS через PACS-фасад
- F3.3 Навигация по срезам (Scroll-инструмент DWV)
- F3.4 Управление яркостью/контрастом (Window Level DWV)
- F3.5 Масштабирование и панорамирование (ZoomAndPan DWV)
- F3.6 Аннотации: Ruler, Circle, Rectangle, FreeHand, Arrow, Angle (Draw DWV)
- F3.7 Загрузка локальных DICOM-файлов через drag-and-drop

**Модуль аутентификации (F4):**
- F4.1 JWT-аутентификация (access + refresh)
- F4.2 Refresh-токены с хранением в БД (можно отзывать)
- F4.3 4 роли: `admin`, `doctor`, `technician`, `registrar` + `viewer`
- F4.4 Защита эндпоинтов через `Depends(get_current_user)` и `Depends(require_role(...))`
- F4.5 Логин по username/password (bcrypt, 12 rounds)
- F4.6 Logout (отзыв refresh-токена)

### 2.2. Технологический стек (v2.0)

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Frontend (язык) | TypeScript | 6.0.2 |
| Frontend (фреймворк) | React | 19.2.6 |
| Frontend (сборка) | Vite | 8.0.12 |
| Frontend (стили) | Tailwind CSS | 4.3.0 |
| Frontend (роутинг) | React Router | 7.16.0 |
| Frontend (DICOM) | DWV | 0.36.3 |
| Backend (язык) | Python | 3.14.3 |
| Backend (фреймворк) | FastAPI | 0.110+ |
| ASGI-сервер | Uvicorn | 0.29+ |
| HTTP-клиент | httpx | 0.27+ |
| DICOM-библиотека | pydicom | 2.4+ |
| Шаблонизатор | Jinja2 | 3.1+ |
| СУБД | PostgreSQL | 16 |
| ORM | SQLAlchemy | 2 (async) |
| Миграции | Alembic | — |
| Аутентификация | JWT (HS256) | — |
| PACS-сервер | Orthanc | 1.12.11 |
| DICOM-просмотрщик | DWV | 0.36.3 |
| Контейнеризация | Docker Compose | — |

**Изменения v1 → v2:**
- SQLite → PostgreSQL 16
- Plain FastAPI → FastAPI + SQLAlchemy 2 (async) + Alembic
- Без аутентификации → JWT (access + refresh) + RBAC
- Простые таблицы → нормализованная схема (auth, queue, ris, audit)
- HTML + JS → React 19 + Vite + TypeScript

---

## ГЛАВА 3. ПРОЕКТИРОВАНИЕ СИСТЕМЫ

### 3.1. Общая архитектура

```
Браузер (React SPA, :5173)
┌────────────────┬────────────────┬────────────────┐
│ Эл. очередь    │ Панель врача   │ DWV Viewer     │
└────────┬───────┴────────┬───────┴────────┬───────┘
         │ JWT            │ JWT            │ JWT
         ▼                ▼                ▼
┌────────────────┐  ┌────────────────────────────────┐
│  elqueue       │  │  RIS (FastAPI :8000)           │
│  :8005         │──┤  /api/orders (workflow)        │
│  (очередь)     │  │  /api/v1/*   (PACS-фасад)      │
└───────┬────────┘  │  /dicom/*    (DICOMweb)        │
        │           └──────┬──────────────────┬──────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────────────────┐    ┌────────────────────┐
│  PostgreSQL 16 (:5432)   │    │  Orthanc 1.12.11    │
│  - auth (users, roles)   │    │  - DICOM Storage   │
│  - queue (tickets)       │    │  - DICOMweb        │
│  - ris (orders, studies) │    │  - REST API        │
│  - audit (audit_log)     │    │  - HTTP :8042      │
│                          │    │  - DICOM :4242     │
└──────────────────────────┘    └────────────────────┘
```

### 3.2. Схема базы данных (v2.0)

**Схема `auth` (аутентификация):**
- `users` — пользователи (id UUID, username, password_hash, is_active, is_superuser, last_login_at, created_at)
- `roles` — роли (id, code — admin/doctor/technician/registrar/viewer, name, description)
- `user_roles` — связь many-to-many (user_id, role_id, assigned_at)
- `refresh_tokens` — refresh-токены (id, user_id, token_hash, expires_at, revoked, created_at)

**Схема `queue` (электронная очередь):**
- `cabinets` — кабинеты (id, code, name, description, is_active)
- `patients` — пациенты (id UUID, full_name, birth_date, policy_number, phone, email, created_at)
- `tickets` — талоны (id, ticket_number UNIQUE, patient_id, cabinet_code, order_id, status, created_at, called_at, completed_at)
- `ticket_events` — журнал событий (id, ticket_id, event_type, payload JSON, created_at)

**Схема `ris` (Radiology Information System):**
- `modalities` — справочник модальностей (id, code, name, description)
- `orders` — заказы на исследования (id 8-hex, patient_id, modality, study_uid, study_description, referring_physician, status, priority, scheduled_for, started_at, completed_at, created_by, created_at, updated_at)
- `studies` — DICOM-исследования в PACS (id, order_id, orthanc_id, is_uploaded, uploaded_at, instance_count, series_count)
- `protocols` — протоколы исследований (id, order_id, body, impression, is_draft, signed_at, signed_by, created_at, updated_at)

**Схема `audit` (аудит):**
- `audit_log` — журнал действий (id, user_id, action, resource_type, resource_id, ip_address, user_agent, extra JSON, ok bool, created_at)

### 3.3. API интерфейсы (v2.0)

**Аутентификация (`/api/auth/*`):**

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| POST | `/api/auth/login` | public | Логин по username/password |
| POST | `/api/auth/refresh` | public | Обновить access-токен |
| POST | `/api/auth/logout` | public | Отозвать refresh-токен |
| GET | `/api/auth/me` | auth | Текущий пользователь |

**Электронная очередь (`/api/...`):**

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/api/cabinets` | auth | Список кабинетов |
| GET | `/api/tickets` | auth | Список талонов (фильтр по cabinet, status) |
| POST | `/api/tickets` | registrar, admin | Регистрация пациента |
| GET | `/api/tickets/{number}` | auth | Статус талона |
| GET | `/api/tickets/{number}/events` | auth | Журнал событий талона |
| POST | `/api/tickets/next` | doctor, technician, admin | Вызвать следующего |
| POST | `/api/tickets/{number}/complete` | doctor, technician, admin | Завершить приём |

**RIS Workflow (`/api/...`):**

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/api/orders` | auth | Список заказов |
| POST | `/api/orders` | auth | Создать заказ |
| GET | `/api/orders/{id}` | auth | Детали заказа |
| PATCH | `/api/orders/{id}/status` | doctor, technician, admin | Сменить статус |
| GET | `/api/orders/{id}/studies` | auth | Исследования заказа |
| GET | `/api/orders/{id}/protocol` | auth | Получить протокол |
| PUT | `/api/orders/{id}/protocol` | doctor, admin | Создать/обновить протокол |
| POST | `/api/orders/{id}/protocol/sign` | doctor, admin | Подписать протокол |
| GET | `/api/modalities` | auth | Справочник модальностей |
| GET | `/api/studies?modality=CT` | auth | Список заказов со снимками |
| GET | `/api/studies/download/{uid}` | auth | Скачать ZIP |
| * | `/api/orthanc/{path}` | auth (GET) / role (POST/PUT) | Прокси к Orthanc |

**PACS-фасад (`/api/v1/...`)** — единая точка работы с DICOM:

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/v1/studies` | Список DICOM-исследований (Orthanc + JOIN) |
| GET | `/api/v1/studies/{study_uid}` | Серии + инстансы + RIS order + patient |
| GET | `/api/v1/studies/{study_uid}/preview` | PNG первого среза |
| GET | `/api/v1/instances/{id}/preview` | PNG конкретного среза |
| GET | `/api/v1/instances/{id}/dicom-tags` | DICOM-теги |
| GET | `/api/v1/instances/{id}/dicom` | **Сырой DICOM-файл (для DWV, JWT)** |
| GET | `/api/v1/patients/{id}/studies` | Снимки пациента |
| GET | `/api/v1/orders/{id}/dicom` | DICOM по RIS-заказу |

**DICOMweb-прокси (`/dicom/*`)** — стандартные сервисы:

| Метод | Путь | Описание |
|---|---|---|
| GET/POST | `/dicom/studies` | QIDO-RS / STOW-RS |
| GET | `/dicom/studies/{uid}/series` | QIDO-RS |
| GET | `/dicom/studies/{uid}/series/{suid}/instances` | QIDO-RS |
| GET | `/dicom/studies/{uid}/series/{suid}/instances/{iuid}/frames/{n}` | WADO-RS |

---

## ГЛАВА 4. РЕАЛИЗАЦИЯ

### 4.1. Сервис электронной очереди (elqueue)

Реализован в `elqueue/`. FastAPI-приложение с HTML-шаблонами (Jinja2) для обратной совместимости и React-фронтендом для новой версии.

**Особенности реализации:**
- Три статуса пациента: `waiting` → `in_progress` → `done`
- Фильтрация по кабинету (101, 102, 103) через параметр `?cabinet=N`
- **Интеграция с RIS:** при регистрации (POST /api/tickets) elqueue вызывает RIS через HTTP — `POST /api/orders`. Если RIS недоступен, талон всё равно сохраняется локально (degraded mode)
- Генерация талона: 6 случайных hex-символов
- Аудит: каждый значимый action (login, ticket_created, ticket_called, ticket_completed) логируется в `audit.audit_log`

**Панель врача (DoctorPage в React):**
- Три колонки: "На приёме", "Ожидают", "Завершённые"
- Кнопки: "Вызвать следующего", "Завершить приём"
- Селектор кабинета
- Polling каждые 10 секунд для обновления списка

### 4.2. Сервис RIS

Реализован в `ris/`. FastAPI-приложение с маршрутизацией по схемам API.

**Особенности реализации:**
- Генерация корректных DICOM UID (только цифры, без дефисов): `1.2.840.{uuid4_int}`
- Генерация 8-символьных hex-ID для заказов: `uuid4().hex[:8]`
- PACS-фасад (`ris/services/pacs_facade.py` + `ris/routers/studies.py`):
  - Скрывает Orthanc от frontend
  - Объединяет данные Orthanc + RIS + Patient в единый JSON
  - Обрабатывает unlinked-снимки (DICOM загружен напрямую в Orthanc, без RIS-заказа)
  - Возвращает ошибки на русском
- Прокси-эндпоинт `/api/orthanc/{path}` для обхода CORS с JWT
- DICOMweb-прокси `/dicom/{path}` с JWT (QIDO-RS, WADO-RS, STOW-RS)
- CORS middleware (dev-режим: `allow_origins=["*"]`)
- Глобальные обработчики ошибок (русские сообщения)

**Workflow заказа (state machine):**
- `scheduled` → `in_progress`: при начале исследования
- `in_progress` → `completed`: при подписании протокола
- Подписание протокола автоматически завершает заказ

**Протокол исследования:**
- Создаётся пустым при создании заказа (`is_draft=true`)
- При редактировании подписанного протокола подпись снимается
- Подписание финализирует заключение и завершает заказ

### 4.3. PACS-фасад (ключевое архитектурное решение)

Реализован в `ris/services/pacs_facade.py`. Это **бизнес-логика** PACS-фасада, вызываемая из роутера `ris/routers/studies.py`.

**Структура ответа `/api/v1/studies`:**
```json
{
  "orthanc_id": "071d0259-...",
  "study_uid": "1.2.840.138647082911948",
  "study_date": "2026-06-02",
  "study_time": "2026-06-02T12:49:17",
  "study_description": "Исследование брюшной полости",
  "modality": "US",
  "patient_id_dicom": "004",
  "patient_name_dicom": "ИВАНОВ^ИВАН^ИВАНОВИЧ",
  "patient_birth_date": "20010830",
  "accession_number": "67A718AB",
  "is_stable": true,
  "unlinked": false,        // true = DICOM загружен напрямую в Orthanc
  "ris_order_id": "2b02cef8",
  "ris_order_status": "in_progress",
  "ris_study_description": "УЗИ брюшной полости",
  "patient": {             // JOIN с auth.users / queue.patients
    "id": "...",
    "full_name": "Иванов И.И.",
    "birth_date": "2001-08-30"
  }
}
```

**Связь Orthanc ↔ RIS:**
1. Поиск пациента: `Orthanc.DICOM.PatientID` → `queue.patients.id` (UUID)
2. Поиск заказа: `ris.studies.orthanc_id` → `Orthanc.Study.ID`
3. Фолбэк: `Orthanc.DICOM.AccessionNumber` → `ris.orders.id` (8 hex)

**Преимущества перед прямым доступом к Orthanc:**
- ✅ Скрытие Orthanc (утечка абстракции)
- ✅ Единый формат JSON
- ✅ JOIN с RIS (orders) и Patient
- ✅ Обработка unlinked-снимков
- ✅ Русские сообщения об ошибках
- ✅ Единая точка аутентификации (JWT)

### 4.4. DICOMweb-прокси

Реализован в `ris/routers/dicomweb.py`. Проксирует `/dicom/*` → `Orthanc /dicom-web/*` с JWT-аутентификацией.

**Зачем нужен прокси?** DWV-просмотрщик может работать через стандартный DICOMweb (QIDO-RS, WADO-RS). Orthanc имеет встроенный DICOMweb, но для безопасности все запросы идут через RIS.

**Особенности:**
- Поддержка всех HTTP-методов (GET, POST, PUT, DELETE, PATCH)
- Корректная обработка `multipart/related` (WADO-RS pixel data) — потоковая передача
- Проброс только нужных заголовков (content-type, content-length, etc.)
- JWT на всех запросах

### 4.5. Просмотрщик DICOM-изображений (DwvViewer)

Реализован в `frontend/src/components/DwvViewer.tsx`. Использует DWV 0.36.3.

**Функциональность:**
- Загрузка DICOM-файлов через `/api/v1/instances/{id}/dicom` (PACS-фасад, JWT)
- Навигация по срезам: колёсико мыши (Scroll-инструмент DWV)
- Оконное управление (Window Level): drag мышью
- Масштабирование: Ctrl+колёсико (ZoomAndPan)
- Панорамирование: drag с зажатой кнопкой
- Аннотации (Draw): Ruler, Circle, Rectangle, FreeHand, Arrow, Angle
- Отображение метаданных исследования (пациент, модальность, ID)
- Счётчик срезов (`Срез 5/10`)
- Загрузка локальных DICOM-файлов (drag-and-drop)
- Обработка ошибок с человеко-понятными сообщениями

**Передача JWT в DWV:**
DWV поддерживает `DicomWebLoadOptions.requestHeaders` для передачи кастомных заголовков. Используется для Authorization:
```ts
loadURLs(urls, { requestHeaders: { Authorization: `Bearer ${token}` } })
```

### 4.6. Аутентификация (JWT)

Реализована в `db/security.py` + `db/dependencies.py` + `frontend/src/contexts/AuthContext.tsx`.

**Backend:**
- Bcrypt для хеширования паролей (12 rounds)
- JWT (HS256) с TTL: access=1ч, refresh=30д
- Refresh-токены хранятся в `auth.refresh_tokens` (можно отзывать)
- `get_current_user` dependency — на всех защищённых эндпоинтах
- `require_role(*roles)` — фабрика зависимостей для RBAC

**Frontend:**
- `AuthContext` хранит user + accessToken в state
- localStorage для персистентности (`mp_access_token`, `mp_refresh_token`, `mp_user`)
- API client автоматически добавляет `Authorization: Bearer ...` ко всем запросам
- Auto-refresh при 401 (best-effort)

### 4.7. Генерация тестовых данных

Реализована в `generate-test-images.py`. Создаёт 4 DICOM-исследования с реалистичными изображениями:

| Исследование | Срезов | Размер | Описание |
|-------------|--------|--------|----------|
| КТ грудной клетки | 10 | 256×256 | Серия аксиальных срезов |
| МРТ поясничного отдела | 8 | 256×256 | T2-взвешенные |
| Рентген грудной клетки | 1 | 512×512 | Прямая проекция |
| УЗИ брюшной полости | 1 | 256×256 | Серошкальное изображение |

**Генератор умеет также создавать 5 исследований уникального пациента** (5 разных UID), что позволяет демонстрировать JOIN с RIS-заказами.

`load-test-data.py` — загружает тестовые данные в БД (пользователи, модальности, кабинеты).

---

## ГЛАВА 5. РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ

### 5.1. Функциональное тестирование

**Сценарий A: Полный цикл (пройден)**
1. Открыта страница регистратуры (порт 8005 или React /register)
2. Введены данные пациента, получен талон
3. Заказ автоматически создан в RIS (POST /api/orders)
4. Пациент вызван на панели врача (POST /api/tickets/next)
5. Исследование просмотрено в DWV (через PACS-фасад)
6. Протокол создан и подписан (PUT /api/orders/{id}/protocol, POST .../sign)
7. Заказ → completed, талон → done

**Сценарий B: Несколько кабинетов (пройден)**
1. Зарегистрированы пациенты на кабинеты 101 (КТ), 102 (МРТ), 103 (Рентген)
2. Фильтрация по кабинету работает корректно
3. Вызов в одном кабинете не влияет на другие

**Сценарий C: Просмотр изображений (пройден)**
1. КТ: 10 срезов, навигация по срезам, WW/WL работают
2. МРТ: 8 срезов, корректное отображение
3. Рентген: 1 снимок высокого разрешения (512×512)
4. УЗИ: 1 снимок, корректное отображение
5. Аннотации (Ruler, Circle) работают

**Сценарий D: Безопасность (пройден)**
1. `GET /api/v1/studies` без токена → 401
2. `GET /api/v1/studies` с токеном `viewer` → 200
3. `POST /api/tickets` без токена → 401
4. `POST /api/tickets` с токеном `viewer` → 403
5. `GET /dicom/studies` (DICOMweb) без токена → 401
6. `GET /api/v1/instances/{id}/dicom` без токена → 401

**Сценарий E: Отказоустойчивость (пройден)**
1. Orthanc остановлен — RIS продолжает работать (PACS-фасад возвращает ошибку)
2. Orthanc запущен — прокси восстанавливается
3. RIS остановлен — elqueue сохраняет талон локально (degraded mode)
4. PostgreSQL остановлен — оба сервиса падают (БД критична)

### 5.2. Сводка результатов

| № | Требование | Статус |
|---|-----------|--------|
| F1.1-1.7 | Электронная очередь | ✓ Выполнено |
| F2.1-2.8 | RIS workflow | ✓ Выполнено |
| F2.9.1-2.9.7 | PACS-фасад | ✓ Выполнено |
| F3.1-3.7 | DWV-просмотрщик | ✓ Выполнено |
| F4.1-4.6 | Аутентификация и RBAC | ✓ Выполнено |
| F5.1-5.4 | Тестирование (4 сценария + безопасность) | ✓ Выполнено |

### 5.3. Code review (08.06.2026)

После завершения MVP проведён полный аудит кода всей системы: backend (FastAPI + PostgreSQL), frontend (React 19 + Vite 8), корень (Next.js 15). Методология: инспекция всех файлов в `backend/`, `frontend/src/`, ключевых файлов корня.

**Найдено 24 проблемы:** 3 критических, 6 высокого приоритета, 8 среднего, 7 низкого.

#### Исправленные критические баги (08.06.2026)

| # | Проблема | Файл | Решение |
|---|----------|------|---------|
| 1 | Vite proxy `/dicom` → Orthanc в обход JWT | `vite.config.ts:25` | Цель изменена на FastAPI `:8000`, удалён rewrite. DICOMweb-запросы идут через JWT-защищённый прокси `dicomweb.py` |
| 2 | `download_study` без JWT — любой мог скачать ZIP | `orders.py:311` | Добавлен `Depends(get_current_user)` |
| 3 | `complete_ticket` race condition | `tickets.py:245` | Добавлен `.with_for_update()` (аналогично `call_next`) |

#### Исправленные значительные (08.06.2026)

| # | Проблема | Файлы | Решение |
|---|----------|-------|---------|
| 4 | 73 `print()` вместо `logging` | `main.py`, `orders.py`, `tickets.py` | Заменены на `logging.getLogger()`. CLI-скрипты оставлены с `print()` |
| 5 | `create_order` без RBAC — любой юзер создавал заказы | `orders.py:92` | `get_current_user` → `require_role(DOCTOR, TECHNICIAN, ADMIN)` |
| 6 | Немые `except:` — аудит и Orthanc-ошибки глотались | 4 файла | Добавлен `logger.warning(..., exc_info=True)` |
| 7 | W/L params не передавались в Orthanc | `pacs_facade.py:453` | `_orthanc_get_bytes` + `params`, `get_instance_preview` + `window_width/level`, эндпоинт + `Query(alias="W/L")` |
| 8 | `httpx.AsyncClient` per request в DICOMweb | `dicomweb.py:39` | Добавлен singleton `_get_client()` с connection pool |
| 9 | 404 на `GET /api/v1/patients/{id}` | `studies.py` | Добавлен эндпоинт |
| 10 | PatientCardPage: «Invalid Date» + key prop | `PatientCardPage.tsx` | API: поля `created_at`, `order_id`, `is_uploaded`, `preview_url`. Frontend: ключ `orthanc_id \|\| study_uid` |

#### Оставшиеся (рекомендации)

| # | Приоритет | Проблема | Файл |
|---|-----------|----------|------|
| 1 | 🟠 | Пароль админа в консоль при старте | `init_db.py:131` |
| 2 | 🟡 | Справочники `/modalities`, `/cabinets` без auth | `orders.py:62`, `tickets.py:48` |
| 3 | 🟡 | `httpx.AsyncClient` per request в orders.py (3 места) | `orders.py:320,371,419` |
| 4 | 🟡 | DwvViewer: 6 пустых catch блоков | `DwvViewer.tsx` |
| 5 | 🟡 | ViewerPage: хардкод localhost:5550 (NestJS) | `ViewerPage.tsx:12` |
| 6 | 🟡 | DoctorPage без polling (ручное обновление) | `DoctorPage.tsx` |
| 7 | 🟡 | useCabinets без AbortController + пустой catch | `useQueue.ts:48` |
| 8 | 🟡 | Токены в 2 хранилищах (in-memory + localStorage) | `AuthContext.tsx` |
| 9 | 🟡 | Нет тестов | весь проект |

**Результат:** 10 из 24 проблем исправлены (3/3 критические, 4/6 высокого приоритета, 3/8 среднего). 0 ошибок TypeScript, 0 ошибок ESLint, 0 ошибок Python compile.

### 5.4. Аудит безопасности

Проведён целевой аудит безопасности JWT + RBAC + Orthanc-прокси:

**Проверено и подтверждено:**
- ✅ JWT на всех эндпоинтах PACS-фасада (`/api/v1/*`) — `Depends(get_current_user)`
- ✅ JWT на DICOMweb-прокси (`/dicom/*`) — `dicomweb.py:85`
- ✅ JWT на Orthanc-прокси GET (`/orthanc/*`) — `orders.py:358`
- ✅ RBAC на Orthanc-прокси POST/PUT/DELETE — `require_role(DOCTOR, TECHNICIAN, ADMIN)`
- ✅ RBAC на чувствительных операциях (подпись протокола, вызов пациента)
- ✅ `with_for_update()` в `call_next` и `complete_ticket`
- ✅ bcrypt (12 rounds), JWT HS256, refresh-токены в БД
- ✅ XSS в `viewer.html` исправлен

**Обнаружено и исправлено:**
- ❌→✅ Vite proxy `/dicom/*` → Orthanc:8042 в обход JWT
- ❌→✅ `download_study` без JWT
- ❌→✅ `create_order` без RBAC
- ❌→✅ Немые except блоки (маскировали ошибки)



---

## ГЛАВА 6. ЗАКЛЮЧЕНИЕ

### 6.1. Результаты работы

В ходе практической работы v2.0 разработан программный комплекс интеграции PACS-RIS с модулем электронной очереди, включающий:

1. **Сервис электронной очереди** на FastAPI + PostgreSQL (порт 8005)
2. **Сервис RIS** с REST API, PACS-фасадом, DICOMweb-прокси (порт 8000)
3. **PACS-фасад** (`/api/v1/*`) — единая точка работы с DICOM (скрывает Orthanc, JOIN с RIS)
4. **Аутентификация** — JWT (access + refresh), RBAC (4 роли), аудит
5. **DWV-просмотрщик** — полноценный DICOM-вьюер (scroll, WW/WL, zoom, draw)
6. **React-фронтенд** — 9 страниц (Login, Queue, Registration, Doctor, Orders, Studies, Viewer, Protocol, Patients)
7. **Генератор тестовых данных** с реалистичными DICOM-изображениями
8. **Безопасность** — полный аудит + устранение 10 уязвимостей (Vite proxy bypass, отсутствие JWT на download, race conditions, RBAC, logging, W/L params)
9. **Документация**: ТЗ, README, отчёт, ARCHITECTURE.md, CODE_REVIEW.md, SESSION.md, WHERE_TO_WORK.md

### 6.2. Использованные технологии

- Python 3.14.3, FastAPI, Uvicorn, pydicom, httpx
- PostgreSQL 16, SQLAlchemy 2 (async), Alembic
- JWT (HS256), bcrypt
- Orthanc 1.12.11 (PACS-сервер, DICOMweb)
- React 19, Vite 8, TypeScript 6, Tailwind CSS 4
- DWV 0.36.3 (DICOM-просмотрщик)
- Docker Compose

### 6.3. Выводы

Разработанная система v2.0 позволяет:
- Автоматизировать процесс записи пациентов на исследования
- Управлять потоками пациентов через электронную очередь
- Централизованно хранить DICOM-изображения в PACS
- Просматривать медицинские изображения через веб-браузер (DWV)
- Управлять протоколами с возможностью подписания
- Обеспечивать безопасный доступ через JWT с ролевой моделью
- Аудитировать все значимые действия

Система демонстрирует принципы интеграции медицинских информационных систем по стандарту IHE (Integrating the Healthcare Enterprise) и может быть использована в учебных целях, а также как основа для дальнейшей разработки с добавлением HL7-совместимости, DICOM MWL/MPPS, расписания и биллинга.

### 6.4. Перспективы развития

**Ближайшие (из code review 08.06):**
1. **Убрать пароль из лога** (`init_db.py:131`) — маскировать при старте
2. **Добавить auth на справочники** — `/modalities`, `/cabinets` без `get_current_user`
3. **httpx connection pool** — заменить `AsyncClient()` per request в `orders.py` (3 места) на singleton
4. **Логирование в DwvViewer** — заменить 6 пустых catch на `console.error`
5. **DoctorPage polling** — автоматическое обновление очереди (как в `useQueue`)
6. **Убрать хардкод localhost:5550** — заменить на актуальный URL или убрать кнопку
7. **Тесты** — хотя бы smoke-тесты на критические эндпоинты (login, tickets, studies)

**Среднесрочные:**
8. **DICOM MWL Provider** (pynetdicom, порт 11112) — аппарат КТ/МРТ будет запрашивать расписание у RIS
9. **DICOM MPPS Receiver** (pynetdicom, порт 11113) — аппарат сообщает о прогрессе исследования
10. **WebSocket** для очереди (вместо polling каждые 10 секунд)
11. **CORS whitelist** (вместо `allow_origins=["*"]`)

**Долгосрочные:**
12. **HL7 MLLP-сервер** (python-hl7, порт 6661) — интеграция с внешней МИС
13. **Расписание** — CRUD + календарь для визуализации загрузки кабинетов
14. **Биллинг** — счета, акты, печать
15. **PDF-печать протоколов** с QR-кодом для верификации
16. **Email/SMS уведомления** пациентам о статусе талона

---

## ПРИЛОЖЕНИЕ 1. СТРУКТУРА ПРОЕКТА

```
MedPlatform/
├── backend/
│   ├── db/                        # Слой данных
│   │   ├── config.py
│   │   ├── session.py
│   │   ├── base.py
│   │   ├── security.py
│   │   ├── dependencies.py
│   │   ├── error_handlers.py
│   │   ├── init_db.py
│   │   ├── init/                  # SQL для первого старта
│   │   ├── models/                # ORM (auth, queue, ris, audit)
│   │   └── schemas/               # Pydantic DTO
│   ├── alembic/                   # Миграции
│   │   └── versions/0001_initial.py
│   ├── elqueue/                   # Сервис очереди (:8005)
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   └── tickets.py
│   │   └── templates/             # HTML (обратная совместимость)
│   │       ├── index.html
│   │       ├── admin.html
│   │       └── login.html
│   ├── ris/                       # Сервис RIS (:8000)
│   │   ├── main.py                # CORS + error handlers
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── orders.py
│   │   │   ├── studies.py         # PACS-фасад /api/v1
│   │   │   └── dicomweb.py        # DICOMweb /dicom
│   │   ├── services/
│   │   │   └── pacs_facade.py     # бизнес-логика фасада
│   │   └── templates/             # HTML (обратная совместимость)
│   │       ├── index.html
│   │       ├── studies.html
│   │       ├── viewer.html
│   │       └── protocol.html
│   ├── static/css/design-system.css
│   ├── docker-compose.yml
│   ├── start.bat
│   ├── generate-test-images.py
│   ├── load-test-data.py
│   ├── README.md
│   ├── REPORT.md                  # этот отчёт
│   ├── TZ.md                      # техзадание
│   ├── DEMO_CHECKLIST.md
│   └── docs/RIS_vs_PACS.md
│
├── frontend/                      # React SPA (:5173)
│   ├── vite.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── eslint.config.js
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── api/
│       ├── contexts/AuthContext.tsx
│       ├── hooks/
│       ├── components/
│       ├── pages/
│       └── types/
│
├── docs/
│   ├── ARCHITECTURE.md
│   └── archive/
│
├── REVIEW.md                      # ревью интеграции DWV
├── BUGS.md                        # баг-трекер
├── TRACKER.md                     # чеклист реализации
├── ORCHESTRATION.md               # лог активности
└── CONTEXT.md                     # контекст проекта
```

## ПРИЛОЖЕНИЕ 2. ЗАПУСК

```powershell
# Установить переменные окружения (важно для русских букв)
$env:PYTHONIOENCODING="utf-8"
$env:PYTHONUTF8="1"
chcp 65001 | Out-Null

# Запуск PostgreSQL
cd C:\Projects\MedPlatform\backend
docker compose up -d postgres

# Инициализация БД
python -m alembic upgrade head
python -m db.init_db

# Запуск сервисов (в отдельных окнах)
python -m uvicorn ris.main:app --port 8000 --host 0.0.0.0
python -m uvicorn elqueue.main:app --port 8005 --host 0.0.0.0

# Запуск Orthanc
.\orthanc\Orthanc.exe orthanc.json

# Загрузка тестовых DICOM
python generate-test-images.py

# Запуск фронтенда
cd C:\Projects\MedPlatform\frontend
npm install
npm run dev

# Открыть:
#   http://localhost:5173  — React SPA
#   http://localhost:8005  — elqueue (HTML)
#   http://localhost:8000  — RIS (HTML, /docs — Swagger)
#   http://localhost:8042  — Orthanc Explorer
#   http://localhost:5050  — pgAdmin (опционально)
```

**Логин:** `admin` / `admin123`

## ПРИЛОЖЕНИЕ 3. СОСТАВ ГРУППЫ

| № | Роль | Основные задачи |
|---|------|----------------|
| 1 | Архитектор / Team Lead | Архитектура, Git, code review |
| 2 | Backend RIS | REST API, pydicom, Orthanc, PACS-фасад |
| 3 | Backend Queue | Очередь, интеграция с RIS |
| 4 | Frontend Lead | Vite+React setup, роутинг, layout |
| 5 (Макс) | Frontend RIS | RegistrationPage, QueuePage, DoctorPage, OrdersPage, StudiesPage |
| 6 | Frontend PACS | ViewerPage, DwvViewer (DWV) |

## ПРИЛОЖЕНИЕ 4. ИСТОРИЯ ВЕРСИЙ

| Версия | Дата | Изменения |
|---|---|---|
| v1.0 | 2026-05 | Первая итерация на SQLite, без аутентификации |
| v2.0 | 2026-06 | Миграция на PostgreSQL 16, JWT, RBAC, PACS-фасад, React 19, DWV, code review |
| v2.1 | 2026-06-08 | Аудит безопасности + исправление 10 уязвимостей: Vite proxy bypass, download_study JWT, complete_ticket race, W/L params, print→logging, silent excepts, RBAC, httpx pool, patient API. Добавлены PatientsPage, PatientCardPage. Отчёт дополнен разделами 5.3–5.4. |

---

*Конец отчёта*
