# ТЕХНИЧЕСКОЕ ЗАДАНИЕ

> 📁 **Активный проект:** `C:\Projects\ARCHIVE\MedPlatform\` (git-репо)
> См. [`WHERE_TO_WORK.md`](../WHERE_TO_WORK.md) — куда писать код и коммитить.

## на разработку полноценной радиологической информационной системы (RIS) с PACS-интеграцией, DICOM-Worklist, HL7-шлюзом и модулем электронной очереди

**Шифр:** ПРАКТИКА-2026-01
**Версия:** 3.0 (02.06.2026 — пересмотр scope: workflow-надстройка → полноценная RIS)
**Дата:** 01.06.2026
**Исполнитель:** 1 чел. (учебная практика)
**Горизонт:** MVP (есть) → v1.0 Production (в ТЗ) → v2.0 Extended (перспектива)

---

## 1. ОБЩИЕ СВЕДЕНИЯ

### 1.1. Полное наименование системы

**Полноценная радиологическая информационная система (RIS) «MedPlatform-RIS»** с интегрированным PACS-архивом, DICOM Modality Worklist, HL7-шлюзом для обмена с МИС, модулем электронной очереди пациентов, расписанием врачей и кабинетов, протоколированием исследований, биллингом и веб-интерфейсом для всех участников процесса (регистратура → врач → пациент).

### 1.2. Основание для разработки

Учебное задание по практике. Цель — спроектировать и реализовать **полноценную RIS-систему** уровня малого/среднего медучреждения (1–3 аппарата, до 5 кабинетов, до 100 исследований/день), пригодную к развёртыванию в production после доработки интеграций.

### 1.3. Архитектурный принцип

Система строится **не как замена существующим решениям** (Orthanc, dcm4chee, OHIF), а как **интеграционная платформа** поверх них:

| Слой | Что реализуем сами | Что берём готовое |
|---|---|---|
| **Presentation (UI)** | React SPA: регистратура, панель врача, расписание, протоколы, очередь, биллинг | — |
| **API Gateway** | FastAPI: REST + WebSocket (уведомления о новой очереди) | — |
| **Workflow Engine** | Конечный автомат состояний: заказ → worklist → исследование → протокол → подпись → закрытие | — |
| **DICOM-шлюз** | DICOM MWL Provider (C-FIND), MPPS Receiver, Storage SCU | Orthanc (C-STORE SCP, WADO, QIDO) |
| **HL7-шлюз** | MLLP-сервер: ORM/ORU/ADT, parser, routing | python-hl7 (lib) |
| **Persistence** | PostgreSQL 16, 4 схемы (auth/queue/ris/audit) + новая `hl7` | — |
| **PACS Storage** | DICOM-файлы + индекс | Orthanc |
| **Auth** | JWT (access+refresh), RBAC, аудит | — |

### 1.4. Целевая аудитория

- **Регистратор** — записывает пациентов, выдаёт талоны
- **Врач-рентгенолог** — описывает снимки, ставит подпись
- **Техник (лаборант)** — выполняет исследование на аппарате
- **Администратор** — управляет пользователями, расписанием, справочниками
- **Пациент** — личный кабинет (просмотр своих снимков и протоколов)
- **Аппарат (модальность)** — получает worklist, отправляет снимки и MPPS

### 1.5. Используемые сокращения

| Сокращение | Расшифровка |
|---|---|
| RIS | Radiology Information System |
| PACS | Picture Archiving and Communication System |
| DICOM | Digital Imaging and Communications in Medicine |
| MWL | Modality Worklist (DICOM C-FIND сервис на стороне RIS) |
| MPPS | Modality Performed Procedure Step (DICOM-уведомления о прогрессе) |
| HL7 v2 | Health Level 7 version 2.x (текстовый протокол обмена мединформацией) |
| ORM | Order Message (HL7 — заказ на исследование) |
| ORU | Observation Result (HL7 — результат/протокол) |
| ADT | Admit/Discharge/Transfer (HL7 — демография пациента) |
| MLLP | Minimal Lower Layer Protocol (транспорт HL7 поверх TCP) |
| SCU/SCP | Service Class User/Provider (DICOM) |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |
| SPA | Single Page Application |
| WADO-RS | Web Access to DICOM Objects by RESTful Services |
| QIDO-RS | Query based on ID for DICOM Objects by RESTful Services |
| PHI | Protected Health Information |
| FHIR | Fast Healthcare Interoperability Resources (перспектива) |

---

## 2. НАЗНАЧЕНИЕ И ЦЕЛИ

### 2.1. Назначение

Полная автоматизация workflow лучевых исследований в медучреждении:
- **Pre-exam:** регистрация пациента, планирование визита, генерация талона
- **Exam-time:** передача worklist на аппарат, приём снимков, контроль качества
- **Post-exam:** создание протокола, подпись врача, передача в МИС
- **Billing:** учёт оказанных услуг, печать счетов
- **Self-service:** личный кабинет пациента

### 2.2. Цели (KPI)

| № | Цель | Метрика |
|---|---|---|
| G1 | Убрать бумажные журналы | 0 бумажных записей (target: 100% в электронном виде) |
| G2 | Убрать ручной ввод данных в аппарат | 100% аппаратов получают данные через DICOM MWL |
| G3 | Сократить время от записи до протокола | среднее ≤ 24 ч (вместо 3–7 дней) |
| G4 | Полная прослеживаемость | каждый шаг фиксируется в audit log |
| G5 | Соответствие 152-ФЗ | PHI в БД, шифрование TLS, журнал доступа |
| G6 | Интеграция с МИС | 100% заказов и результатов через HL7 ORM/ORU |
| G7 | Самообслуживание пациентов | ≥ 30% пациентов пользуются личным кабинетом |

---

## 3. АРХИТЕКТУРА

### 3.1. Диаграмма (v3.0 — production)

```
Внешние участники:
  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │  Регистратор│  │  Врач      │  │  Пациент   │  │  МИС       │
  │  (браузер)  │  │  (браузер) │  │  (браузер) │  │  (HL7)     │
  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
        │ HTTPS+JWT     │ HTTPS+JWT     │ HTTPS+JWT     │ MLLP:6661
        ▼               ▼               ▼               ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                   FRONTEND (React SPA)                       │
  │  /registration /queue /doctor /schedule /viewer /protocol    │
  │  /billing /admin /patient-portal                              │
  └─────────────────────┬────────────────────────────────────────┘
                        │ REST + WebSocket
                        ▼
  ┌──────────────────────────────────────────────────────────────┐
  │               API GATEWAY (FastAPI)                          │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
  │  │ auth/rbac│ │ workflow │ │ orders   │ │ patients │         │
  │  │ audit    │ │ schedule │ │ reports  │ │ billing  │         │
  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
  └────┬──────────┬──────────────┬──────────────┬───────────────┘
       │          │              │              │
       │          │  DICOM       │  HL7         │
       │          ▼              ▼              │
       │   ┌────────────┐  ┌────────────┐      │
       │   │ DICOM GW   │  │ HL7 GW     │      │
       │   │ pynetdicom │  │ python-hl7 │      │
       │   │ port 11112 │  │ port 6661  │      │
       │   └─────┬──────┘  └─────┬──────┘      │
       │         │               │              │
       │         ▼               ▼              │
       │   ┌────────────┐  ┌────────────┐      │
       │   │ Orthanc    │  │ HL7 Router│      │
       │   │ PACS       │  │ (ORM/ORU/ │      │
       │   │ :8042/:4242│  │  ADT)     │      │
       │   └─────┬──────┘  └────────────┘      │
       │         │                              │
       └─────────┼──────────────────────────────┘
                 ▼
        ┌─────────────────────────┐
        │   PostgreSQL 16         │
        │   Схемы:                │
        │    • auth               │
        │    • queue              │
        │    • ris                │
        │    • audit              │
        │    • hl7 (new)          │
        │    • billing (new)      │
        │    • schedule (new)     │
        └─────────────────────────┘
```

### 3.2. Компоненты

| # | Компонент | Реализация | Статус |
|---|---|---|---|
| 1 | API Gateway | FastAPI | ✅ MVP |
| 2 | Auth/RBAC | JWT + bcrypt | ✅ MVP |
| 3 | Audit | append-only log | ✅ MVP |
| 4 | Эл. очередь | FastAPI + PostgreSQL | ✅ MVP |
| 5 | Workflow RIS | FastAPI + state machine | ✅ MVP |
| 6 | PACS-интеграция | Orthanc + прокси | ✅ MVP |
| 7 | DICOM MWL Provider | **pynetdicom** | ⬜ v1.0 |
| 8 | DICOM MPPS Receiver | **pynetdicom** | ⬜ v1.0 |
| 9 | DICOM Storage SCU | **pynetdicom** (отправка на Orthanc) | ⬜ v1.0 |
| 10 | HL7 MLLP-сервер | **python-hl7 + asyncio** | ⬜ v1.0 |
| 11 | HL7 ORM-парсер | заявки из МИС | ⬜ v1.0 |
| 12 | HL7 ORU-эмиттер | протоколы в МИС | ⬜ v1.0 |
| 13 | HL7 ADT-приёмник | демография пациентов | ⬜ v1.0 |
| 14 | Расписание | CRUD + календарь | ⬜ v1.0 |
| 15 | Биллинг | счета, акты, печать | ⬜ v1.0 |
| 16 | Пациент-кабинет | React-страница + доступ по полису | ⬜ v2.0 |
| 17 | Уведомления | WebSocket + email | ⬜ v2.0 |
| 18 | DWV Viewer | DWV (вместо Canvas-fallback) | ⬜ v2.0 |
| 19 | Hanging Protocols | presets по модальности | ⬜ v2.0 |
| 20 | FHIR-экспорт | перспектива | ⬜ v3.0 |

### 3.3. Архитектура PACS (v1.0)

```
                        Аппарат КТ/МРТ/CR/US
                  (DICOM modality, AE Title = модальность)
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
   C-FIND MWL             C-STORE               N-CREATE/SET MPPS
   (port 11112)           (port 4242)            (port 11113)
        │                       │                       │
        ▼                       ▼                       ▼
  ┌──────────┐           ┌─────────────┐         ┌──────────────┐
  │ pynetdicom│          │   Orthanc   │         │  pynetdicom  │
  │  MWL SCP │           │ Storage SCP │         │  MPPS SCP    │
  │  AE:     │           │ AE: ORTHANC │         │  AE:         │
  │ MEDPLAT. │           │ port 4242   │         │ MEDPLAT_MPPS │
  └─────┬────┘           └──────┬──────┘         └──────┬───────┘
        │                       │                       │
        │ SQL                   │ HTTP REST             │ SQL
        │ (read)                │ (upload+query)        │ (update)
        ▼                       ▼                       ▼
              ┌──────────────────────────────────┐
              │     PostgreSQL 16 (pacs_ris)     │
              │  ┌──────┬──────┬──────┬───────┐  │
              │  │ auth │queue │ ris  │ audit │  │
              │  └──────┴──────┴──────┴───────┘  │
              └──────────────────────────────────┘
                                ▲
                                │ HTTP
                                │
                    ┌───────────┴───────────┐
                    │  RIS FastAPI (8000)   │
                    │  - orders/CRUD        │
                    │  - schedule/slot      │
                    │  - proxy → Orthanc    │
                    └───────────────────────┘
```

**Разделение ответственности:**
- **Orthanc** — DICOM Storage SCP (приём C-STORE от аппаратов), WADO/QIDO REST, сжатие, поиск
- **pynetdicom MWL SCP** (port 11112) — отвечает на C-FIND от аппарата: возвращает список RIS-заказов со статусом `scheduled`
- **pynetdicom MPPS SCP** (port 11113) — принимает N-CREATE (аппарат начал исследование) и N-SET (закончил), обновляет статус RIS-заказа

**Почему не «всё в Orthanc»:** плагины Orthanc не реализуют MWL/MPPS — это специфические DICOM-сервисы, требующие полноценного DICOM-стека. Orthanc — это Storage + HTTP API, не workflow.

**См. ADR-002** (раздел 16) — обоснование выбора платформы.

---

## 4. ФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ

### 4.1. Аутентификация и авторизация (auth)

| ID | Требование | Статус |
|---|---|---|
| F0.1 | Логин (username+password → JWT pair) | ✅ MVP |
| F0.2 | Refresh access token | ✅ MVP |
| F0.3 | Logout (revoke refresh в БД) | ✅ MVP |
| F0.4 | Текущий пользователь (GET /api/auth/me) | ✅ MVP |
| F0.5 | RBAC: require_role | ✅ MVP |
| F0.6 | bcrypt (напрямую, без passlib) | ✅ MVP |
| F0.7 | TTL: access 60 мин, refresh 7 дней | ✅ MVP |
| **F0.8** | **2FA (TOTP) для admin/doctor** | ⬜ v1.0 |
| **F0.9** | **SAML/OIDC SSO (для интеграции с МИС)** | ⬜ v2.0 |
| **F0.10** | **Password policy (сложность, ротация)** | ⬜ v1.0 |

### 4.2. Пациенты (queue.patients)

| ID | Требование | Статус |
|---|---|---|
| F1.1 | Создание пациента | ✅ MVP |
| F1.2 | Поиск (по ФИО, полису, телефону) | ✅ MVP |
| F1.3 | Merge дубликатов (ручной + авто по полису) | ⬜ v1.0 |
| **F1.4** | **Приём ADT^A01/A04/A08 из МИС** | ⬜ v1.0 |
| F1.5 | История визитов (все талоны + заказы) | ⬜ v1.0 |
| F1.6 | Экспорт в PDF (согласие на обработку ПДн) | ⬜ v2.0 |

### 4.3. Электронная очередь (queue)

| ID | Требование | Статус |
|---|---|---|
| F2.1 | Регистрация талона (POST /api/tickets) | ✅ MVP |
| F2.2 | Генерация талона (6 hex) | ✅ MVP |
| F2.3 | Список талонов с фильтрами | ✅ MVP |
| F2.4 | Журнал событий | ✅ MVP |
| F2.5 | Вызов следующего (FIFO SKIP LOCKED) | ✅ MVP |
| F2.6 | Завершение приёма | ✅ MVP |
| F2.7 | Статусы: waiting → in_progress → done / cancelled | ✅ MVP |
| F2.8 | Автообновление (10 сек) | ✅ MVP |
| **F2.9** | **SMS/email-уведомление «Вы 3-й в очереди»** | ⬜ v2.0 |
| **F2.10** | **Предварительная запись через сайт** | ⬜ v2.0 |

### 4.4. Заказы на исследования (ris.orders)

| ID | Требование | Статус |
|---|---|---|
| F3.1 | Создание заказа (POST /api/orders) | ✅ MVP |
| F3.2 | Список заказов с фильтрами | ✅ MVP |
| F3.3 | Детали заказа | ✅ MVP |
| F3.4 | PATCH статуса (с RBAC) | ✅ MVP |
| F3.5 | DICOM StudyInstanceUID генерация | ✅ MVP |
| F3.6 | Интеграция с PACS (создание DICOM, отправка в Orthanc) | ✅ MVP |
| F3.7 | Прокси Orthanc (read public, write с auth) | ✅ MVP |
| **F3.8** | **Привязка к расписанию (slot_id)** | ⬜ v1.0 |
| **F3.9** | **Приоритеты (stat/urgent/routine)** | ⬜ v1.0 |
| **F3.10** | **Связанные заказы (multi-modality study)** | ⬜ v2.0 |

### 4.5. Протоколы (ris.protocols)

| ID | Требование | Статус |
|---|---|---|
| F4.1 | Создание/обновление протокола (PUT) | ✅ MVP |
| F4.2 | Шаблоны по модальности (CT/MR/DX) | ⬜ v1.0 |
| F4.3 | Подпись протокола (POST sign) | ✅ MVP |
| F4.4 | Версионирование (история правок) | ⬜ v1.0 |
| F4.5 | Структурированные поля (findings, impression) | ⬜ v1.0 |
| F4.6 | Автосохранение черновика (каждые 30 сек) | ⬜ v2.0 |
| **F4.7** | **Эмиссия ORU^R01 в МИС** | ⬜ v1.0 |
| **F4.8** | **DICOM Structured Report (SR) генерация** | ⬜ v2.0 |
| F4.9 | Печать PDF (для архива, бумажной версии) | ⬜ v1.0 |

### 4.6. DICOM-интеграция (dicom_gw)

| ID | Требование | Статус |
|---|---|---|
| **F5.1** | **DICOM MWL Provider (C-FIND SCP, port 11112)** | ⬜ v1.0 |
| **F5.2** | **DICOM MPPS Receiver (N-CREATE/N-SET SCP)** | ⬜ v1.0 |
| **F5.3** | **DICOM Storage SCU (отправка на Orthanc C-STORE)** | ⬜ v1.0 |
| F5.4 | Проксирование WADO-RS, QIDO-RS через Orthanc | ⬜ v1.0 |
| F5.5 | AE Title конфигурация (по умолчанию MEDPLATFORM) | ⬜ v1.0 |
| F5.6 | Тестирование: C-ECHO к симулятору (storescu) | ⬜ v1.0 |

**Стек:** `pynetdicom` 2.x (Python DICOM-стек). Orthanc выступает Storage SCP.

### 4.7. HL7-шлюз (hl7_gw)

| ID | Требование | Статус |
|---|---|---|
| **F6.1** | **MLLP-сервер (TCP, port 6661)** | ⬜ v1.0 |
| **F6.2** | **Парсер HL7 v2.5 (MSH/PID/PV1/OBR/OBX)** | ⬜ v1.0 |
| **F6.3** | **Приём ADT^A01/A04/A08/A40 (merge)** | ⬜ v1.0 |
| **F6.4** | **Приём ORM^O01 (заказ на исследование из МИС)** | ⬜ v1.0 |
| **F6.5** | **Эмиссия ORU^R01 (протокол в МИС)** | ⬜ v1.0 |
| **F6.6** | **ACK-ответы (AA/AE/AR)** | ⬜ v1.0 |
| F6.7 | Очередь недоставленных сообщений (DLQ) | ⬜ v1.0 |
| F6.8 | Ретрансляция при сбое МИС | ⬜ v1.0 |
| F6.9 | Журнал всех HL7-транзакций | ⬜ v1.0 |

**Стек:** `python-hl7` (парсер) + `asyncio` MLLP-сервер. Сообщения в UTF-8, сегменты `\r`.

### 4.8. Расписание (schedule) — НОВЫЙ МОДУЛЬ

| ID | Требование | Статус |
|---|---|---|
| F7.1 | Справочник ресурсов (аппараты, кабинеты) | ⬜ v1.0 |
| F7.2 | Рабочие смены (шаблоны по дням недели) | ⬜ v1.0 |
| F7.3 | Слоты (временные интервалы) | ⬜ v1.0 |
| F7.4 | Привязка заказа к слоту | ⬜ v1.0 |
| F7.5 | Календарь врача/кабинета (UI) | ⬜ v1.0 |
| F7.6 | Конфликты и перекрытия (валидация) | ⬜ v1.0 |
| F7.7 | Перенос / отмена с уведомлением | ⬜ v2.0 |

### 4.9. Биллинг (billing) — НОВЫЙ МОДУЛЬ

| ID | Требование | Статус |
|---|---|---|
| F8.1 | Справочник услуг (price list) | ⬜ v1.0 |
| F8.2 | Стоимость по модальности (CT/MR/DX) | ⬜ v1.0 |
| F8.3 | Счёт на заказ (при создании) | ⬜ v1.0 |
| F8.4 | Оплата (наличные / карта / ОМС) | ⬜ v1.0 |
| F8.5 | Акт выполненных работ (PDF) | ⬜ v1.0 |
| F8.6 | Отчёт по выручке за период | ⬜ v1.0 |
| F8.7 | Интеграция с ОМС (реестр счетов) | ⬜ v3.0 |

### 4.10. Аудит (audit)

| ID | Требование | Статус |
|---|---|---|
| F9.1 | Append-only лог | ✅ MVP |
| F9.2 | Покрытие значимых действий | ✅ MVP |
| F9.3 | INET для IP, JSONB payload | ✅ MVP |
| **F9.4** | **Доступ к audit (роль admin/auditor)** | ⬜ v1.0 |
| **F9.5** | **Хранение ≥ 5 лет (152-ФЗ)** | ⬜ v1.0 |
| **F9.6** | **Экспорт для регуляторов** | ⬜ v2.0 |

---

## 5. ТЕХНОЛОГИЧЕСКИЙ СТЕК

### 5.1. Серверная часть

| Компонент | Технология | Версия | Статус |
|---|---|---|---|
| Язык | Python | 3.14.3 | ✅ |
| Веб-фреймворк | FastAPI | 0.115.6 | ✅ |
| ASGI-сервер | Uvicorn | 0.32.1 | ✅ |
| ORM | SQLAlchemy 2.0 | 2.0.36+ | ✅ |
| Async-драйвер PG | asyncpg | 0.31.0 | ✅ |
| Sync-драйвер PG | psycopg v3 | 3.2.3 | ✅ |
| Миграции | Alembic | 1.14.0 | ✅ |
| DICOM-стек | **pynetdicom** | 2.x | ⬜ v1.0 |
| DICOM-данные | pydicom | 2.4.4 | ✅ |
| HL7-парсер | **python-hl7** | 1.x | ⬜ v1.0 |
| MLLP-транспорт | **asyncio + TCP** | — | ⬜ v1.0 |
| Шаблонизатор | Jinja2 | 3.1.5 | ✅ |
| HTTP-клиент | httpx | 0.28.1 | ✅ |
| Хеш | bcrypt | 4.2.1 | ✅ |
| JWT | PyJWT | 2.10.1 | ✅ |
| Валидация | Pydantic v2 | 2.10.3 | ✅ |
| WebSocket | **FastAPI native** | — | ⬜ v2.0 |
| Очередь задач | **Celery + Redis** | — | ⬜ v2.0 |
| PACS | Orthanc | 26.6.0 | ✅ |
| СУБД | PostgreSQL | 16 | ✅ |
| Кэш/брокер | **Redis** | 7 | ⬜ v1.0 |

### 5.2. Клиентская часть

| Компонент | Технология |
|---|---|
| Фреймворк | React 18 + Vite + TypeScript |
| Роутинг | React Router v6 |
| Стили | Tailwind CSS v4 |
| HTTP | fetch + custom client (JWT, refresh, retry) |
| State | Zustand / Context API |
| Формы | react-hook-form + zod |
| Дата/время | dayjs |
| DICOM-viewer | DWV (вместо Canvas-fallback) |
| Календарь | FullCalendar |
| Графики | recharts |
| Тесты | Vitest + Playwright |

### 5.3. Инфраструктура

- **Контейнеризация:** Docker Compose для dev, Kubernetes manifests для prod
- **CI/CD:** GitHub Actions (линтер, тесты, сборка, деплой)
- **Мониторинг:** Prometheus + Grafana
- **Логи:** ELK / Loki
- **Backup:** pg_dump + S3

### 5.4. Требования к production-окружению

- 2 × CPU, 8 ГБ RAM, 100 ГБ SSD
- PostgreSQL 16 (отдельный хост)
- Orthanc (отдельный хост, 1 ТБ DICOM-archive)
- TLS 1.3 (обратный прокси nginx)
- Резервное копирование: 7-дневный rolling backup БД + DICOM

---

## 6. API

### 6.1. REST API (общий)

Префикс: `/api/v1/...` (v1 вводится с v1.0 release)

| Группа | Метод | Путь | Описание | Статус |
|---|---|---|---|---|
| **auth** | POST | `/auth/login` | Логин | ✅ |
| | POST | `/auth/refresh` | Новый access | ✅ |
| | POST | `/auth/logout` | Revoke refresh | ✅ |
| | GET | `/auth/me` | Текущий пользователь | ✅ |
| **patients** | GET | `/patients?q=...` | Поиск | ✅ |
| | POST | `/patients` | Создать | ✅ |
| | PATCH | `/patients/{id}` | Обновить | ✅ |
| | POST | `/patients/{id}/merge` | Merge дубликатов | ⬜ |
| | GET | `/patients/{id}/history` | История визитов | ⬜ |
| **queue** | GET | `/cabinets` | Список кабинетов | ✅ |
| | GET | `/tickets?cabinet=101` | Список талонов | ✅ |
| | POST | `/tickets` | Регистрация | ✅ |
| | POST | `/tickets/next?cabinet=...` | FIFO | ✅ |
| | POST | `/tickets/{n}/complete` | Завершить | ✅ |
| **orders** | GET | `/orders?status=...` | Список | ✅ |
| | POST | `/orders` | Создать | ✅ |
| | GET | `/orders/{id}` | Детали | ✅ |
| | PATCH | `/orders/{id}/status` | Сменить статус | ✅ |
| | PUT | `/orders/{id}/protocol` | Сохранить протокол | ✅ |
| | POST | `/orders/{id}/protocol/sign` | Подписать | ✅ |
| | GET | `/orders/{id}/archive` | Скачать DICOM | ✅ |
| | POST | `/orders/{id}/cancel` | Отменить | ⬜ |
| **schedule** | GET | `/resources` | Аппараты, кабинеты | ⬜ |
| | GET | `/schedule?date=...&resource=...` | Календарь | ⬜ |
| | POST | `/schedule/slots` | Создать слоты | ⬜ |
| | PATCH | `/schedule/slots/{id}` | Перенести | ⬜ |
| | DELETE | `/schedule/slots/{id}` | Удалить | ⬜ |
| **billing** | GET | `/services` | Прайс-лист | ⬜ |
| | POST | `/invoices` | Создать счёт | ⬜ |
| | GET | `/invoices/{id}` | Счёт | ⬜ |
| | POST | `/invoices/{id}/payments` | Оплата | ⬜ |
| | GET | `/reports/revenue?from=...&to=...` | Выручка | ⬜ |
| **dicom** | GET | `/orthanc/...` | Прокси Orthanc | ✅ |
| | GET | `/mwl?date=...&modality=...` | Список worklist | ⬜ |
| | GET | `/mpps/{id}` | Статус MPPS | ⬜ |
| **hl7** | GET | `/hl7/messages?direction=...&date=...` | Журнал | ⬜ |
| | POST | `/hl7/test/send` | Тестовая отправка | ⬜ |

### 6.2. WebSocket (v2.0)

| Endpoint | Событие |
|---|---|
| `/ws/queue` | Новый талон, изменение статуса |
| `/ws/doctor` | Назначен заказ, получены снимки |
| `/ws/admin` | Системные события |

### 6.3. DICOM-сервисы (v1.0)

| Service | AE Title | Port | Тип |
|---|---|---|---|
| Modality Worklist | MEDPLATFORM_MWL | 11112 | SCP |
| Modality Performed Procedure Step | MEDPLATFORM_MPPS | 11113 | SCP |
| Storage (на Orthanc) | ORTHANC | 4242 | SCP (принимает) |
| Verification (Echo) | MEDPLATFORM | 11114 | SCP |

### 6.4. HL7-сервисы (v1.0)

| Endpoint | Port | Профиль |
|---|---|---|
| MLLP-сервер | 6661 | ADT + ORM (приём) |
| MLLP-клиент (outbound) | — | ORU (отправка в МИС) |

---

## 7. СТРУКТУРА БАЗЫ ДАННЫХ

### 7.1. Схемы PostgreSQL (v3.0)

| Схема | Назначение | Новые таблицы v1.0+ |
|---|---|---|
| `auth` | Пользователи, роли, refresh | user_2fa, password_history |
| `queue` | Пациенты, кабинеты, талоны | — |
| `ris` | Заказы, протоколы, исследования | order_scheduling, protocol_versions |
| `audit` | Append-only лог | audit_archive (для 5+ летних записей) |
| **`hl7`** | **HL7-сообщения** | hl7_messages, hl7_routes, hl7_dlq |
| **`schedule`** | **Расписание** | resources, shifts, slots, slot_assignments |
| **`billing`** | **Биллинг** | services, invoices, payments, insurance_claims |

### 7.2. Ключевые таблицы (новые)

**`hl7.hl7_messages`:**
| Поле | Тип | Описание |
|---|---|---|
| id | UUID PK | |
| direction | VARCHAR(8) | inbound / outbound |
| message_type | VARCHAR(16) | ADT/ORM/ORU/ACK |
| trigger_event | VARCHAR(8) | A01/O01/R01/... |
| sending_app | VARCHAR(64) | |
| receiving_app | VARCHAR(64) | |
| patient_id | UUID (FK queue) | |
| order_id | VARCHAR(8) (FK ris) | |
| raw_message | TEXT | |
| parsed_payload | JSONB | |
| ack_status | VARCHAR(8) | AA/AE/AR/pending |
| ack_message | TEXT | |
| received_at | TIMESTAMPTZ | |
| processed_at | TIMESTAMPTZ | |
| retry_count | INT | default 0 |

**`schedule.resources`:**
| Поле | Тип | Описание |
|---|---|---|
| id | UUID PK | |
| code | VARCHAR(32) UNIQUE | |
| type | VARCHAR(16) | modality/room/doctor |
| name | VARCHAR(128) | |
| modality | VARCHAR(8) | CT/MR/DX |
| ae_title | VARCHAR(16) | для DICOM-интеграции |
| is_active | BOOLEAN | |

**`schedule.shifts`:**
| id, resource_id, weekday, start_time, end_time, valid_from, valid_to |

**`schedule.slots`:**
| id, resource_id, doctor_id, start_at, end_at, status (free/reserved/blocked), order_id |

**`schedule.slot_assignments`:**
| id, slot_id, order_id, assigned_at, assigned_by, cancelled_at |

**`billing.services`:**
| id, code, name, modality, price, valid_from, valid_to, is_active |

**`billing.invoices`:**
| id, patient_id, order_id, total_amount, status (draft/issued/paid/cancelled), issued_at, paid_at, created_by |

**`billing.invoice_items`:**
| id, invoice_id, service_id, quantity, unit_price, amount |

**`billing.payments`:**
| id, invoice_id, amount, method (cash/card/insurance/oms), reference, paid_at, cashier_id |

### 7.3. Роли PostgreSQL (без изменений)

`pacs` (superuser), `pacs_migrator` (DDL), `pacs_app` (runtime).

---

## 8. РАСПРЕДЕЛЕНИЕ РАБОТ (В ОДИН ПРАКТИКАНТ — РЕАЛИСТИЧНЫЙ ПЛАН)

| # | Этап | Содержание | Трудоёмкость |
|---|---|---|---|
| 1 | Проектирование | ТЗ v3.0, ER-диаграмма, API-контракты | 1 день |
| 2 | Backend core | 4 схемы, Alembic, JWT, RBAC | ✅ сделано |
| 3 | Очередь | POST /tickets, FIFO, события | ✅ сделано |
| 4 | RIS orders | CRUD заказов, протоколы, подпись | ✅ сделано |
| 5 | PACS | Orthanc + прокси, DICOM-генерация | ✅ сделано |
| 6 | Frontend MVP | 5 страниц (Vanilla JS) | ✅ сделано |
| 7 | Аудит | Append-only | ✅ сделано |
| **8** | **DICOM MWL** | pynetdicom, C-FIND SCP | **2 дня** |
| **9** | **DICOM MPPS** | pynetdicom, N-CREATE/N-SET | **1 день** |
| **10** | **DICOM Storage SCU** | Отправка на Orthanc | **0.5 дня** |
| **11** | **HL7 ADT/ORM** | MLLP, python-hl7, маршрутизация | **3 дня** |
| **12** | **HL7 ORU** | Эмиссия результатов | **1 день** |
| **13** | **Расписание** | CRUD, календарь, валидация | **3 дня** |
| **14** | **Биллинг** | Справочник, счета, оплата, отчёты | **4 дня** |
| **15** | **Frontend (React)** | Миграция с Vanilla JS на React | **5 дней** |
| **16** | **WebSocket** | Уведомления | **1 день** |
| **17** | **2FA** | TOTP для admin/doctor | **1 день** |
| **18** | **DWV-viewer** | Подключение вместо Canvas | **0.5 дня** |
| **19** | **Тесты** | pytest, Vitest, Playwright | **3 дня** |
| **20** | **Документация** | USER_GUIDE, DEV_GUIDE, TEST_REPORT | **2 дня** |

**Итого:** ~30 рабочих дней (≈ 6 недель) на полный v1.0 силами одного практиканта. В production-команде (3–4 бэкендера, 2 фронта) — 2–3 недели.

---

## 9. КАЛЕНДАРНЫЙ ПЛАН (v3.0)

| Период | Задачи | Статус |
|---|---|---|
| **MVP (есть)** | | |
| День 1 | Проектирование, ТЗ v1.0, репозиторий | ✅ |
| День 2-3 | PostgreSQL + Alembic | ✅ |
| День 3-4 | Backend elqueue (auth + tickets) | ✅ |
| День 4-5 | Backend RIS (orders + protocols) | ✅ |
| День 5-6 | Интеграция с Orthanc, Frontend Vanilla JS | ✅ |
| День 7-8 | Тестовые данные, e2e | ✅ |
| День 8-9 | Code review, актуализация ТЗ v2.0/v3.0 | ✅ |
| **v1.0 (план)** | | |
| Неделя 2 | DICOM MWL, MPPS, Storage SCU (этапы 8-10) | ⬜ |
| Неделя 3 | HL7 ADT/ORM/ORU (этапы 11-12) | ⬜ |
| Неделя 4 | Расписание (этап 13) | ⬜ |
| Неделя 5 | Биллинг (этап 14) | ⬜ |
| Неделя 6 | Frontend React, WebSocket, 2FA, DWV, тесты, документация (этапы 15-20) | ⬜ |

---

## 10. КРИТЕРИИ ПРИЁМКИ

### MVP (есть) ✅
- 2 FastAPI-сервиса, /health → 200
- E2E: логин → талон → заказ → вызов → завершение
- DICOM-viewer показывает снимки
- 14 таблиц в 4 схемах, Alembic-миграции
- JWT + RBAC работают

### v1.0 Production (ТЗ)
1. **DICOM-интеграция:**
   - C-ECHO от симулятора → success
   - C-FIND на MWL → возвращает заказы RIS
   - C-STORE от симулятора → снимки в Orthanc
   - MPPS N-CREATE → заказ в RIS получает статус in_progress
2. **HL7-интеграция:**
   - ADT^A01 из МИС → пациент в БД
   - ORM^O01 из МИС → заказ в RIS
   - ORU^R01 в МИС при подписании протокола
   - ACK-ответы корректные
3. **Расписание:**
   - Создание слотов на неделю
   - Привязка заказа к слоту
   - Календарь (UI) показывает загрузку
4. **Биллинг:**
   - Счёт создаётся автоматически при заказе
   - Оплата фиксируется
   - Отчёт по выручке работает
5. **Аудит:** все значимые действия логируются, доступ через API (admin)
6. **Безопасность:** 2FA для admin/doctor, HTTPS, rate limiting
7. **Тесты:** ≥ 70% покрытие, e2e Playwright
8. **Документация:** USER_GUIDE, DEV_GUIDE, TEST_REPORT

### v2.0 Extended (перспектива)
- Пациент-кабинет (React)
- Уведомления (SMS, email, WebSocket)
- Hanging protocols
- DICOM Structured Reports
- Интеграция с ОМС

---

## 11. ТРЕБОВАНИЯ К БЕЗОПАСНОСТИ

| ID | Требование | MVP | v1.0 |
|---|---|---|---|
| S1 | bcrypt для паролей | ✅ | ✅ |
| S2 | JWT (access+refresh) | ✅ | ✅ |
| S3 | RBAC | ✅ | ✅ |
| S4 | Audit (append-only) | ✅ | ✅ |
| S5 | SQL-инъекции — параметризованные запросы | ✅ | ✅ |
| S6 | Secrets в .env, не в репо | ✅ | ✅ |
| S7 | Split proxy (read public, write с auth) | ✅ | ✅ |
| **S8** | **HTTPS / TLS 1.3 (nginx)** | ⬜ | ✅ |
| **S9** | **2FA (TOTP) для admin/doctor** | ⬜ | ✅ |
| **S10** | **Rate limiting (login, API)** | ⬜ | ✅ |
| **S11** | **CSRF (cookie-based auth)** | ⬜ | ✅ |
| **S12** | **Соответствие 152-ФЗ** (согласие, хранение ≥ 5 лет) | ⬜ | ✅ |
| **S13** | **Шифрование PHI at rest (TDE/cryptsetup)** | ⬜ | ⬜ v2.0 |
| **S14** | **DICOM TLS (DICOM Secure Transport)** | ⬜ | ⬜ v2.0 |
| **S15** | **WAF (ModSecurity)** | ⬜ | ⬜ v2.0 |

---

## 12. ТРЕБОВАНИЯ К ПРОИЗВОДИТЕЛЬНОСТИ

| Параметр | MVP | v1.0 | v2.0 |
|---|---|---|---|
| `/health` отклик | ≤ 50 мс | ≤ 50 мс | ≤ 20 мс |
| Логин | ≤ 500 мс | ≤ 300 мс | ≤ 200 мс |
| Регистрация пациента | ≤ 1 с | ≤ 500 мс | ≤ 300 мс |
| MWL C-FIND (100 записей) | — | ≤ 1 с | ≤ 500 мс |
| HL7 ADT приём + парсинг | — | ≤ 200 мс | ≤ 100 мс |
| Биллинг отчёт за месяц | — | ≤ 5 с | ≤ 2 с |
| Параллельных пользователей | 5 | 50 | 200 |
| Заказов в день | 20 | 200 | 1000 |
| DICOM в Orthanc (ТБ) | 0.1 | 5 | 50 |

---

## 13. СОСТАВ ДОКУМЕНТАЦИИ

1. **TZ.md** (этот документ)
2. **README.md** — quickstart
3. **db/README.md** — БД-слой
4. **ARCHITECTURE.md** — архитектура (есть в `docs/`)
5. **USER_GUIDE.md** — руководство пользователя (по ролям)
6. **DEV_GUIDE.md** — руководство разработчика
7. **TEST_REPORT.md** — отчёт о тестировании
8. **DICOM_INTEGRATION.md** — описание DICOM-интеграции (v1.0)
9. **HL7_INTEGRATION.md** — описание HL7-шлюза (v1.0)
10. **DEPLOYMENT.md** — развёртывание в production
11. Swagger/OpenAPI — автогенерация `/docs`

---

## 14. СТРУКТУРА ПРОЕКТА (v3.0)

```
MedPlatform/
├── backend/
│   ├── alembic/                       # Миграции
│   │   └── versions/
│   │       ├── 0001_initial.py        # auth/queue/ris/audit (есть)
│   │       ├── 0002_hl7.py            # v1.0
│   │       ├── 0003_schedule.py       # v1.0
│   │       └── 0004_billing.py        # v1.0
│   ├── db/
│   │   ├── config.py
│   │   ├── session.py
│   │   ├── security.py
│   │   ├── dependencies.py
│   │   ├── init_db.py
│   │   ├── init/
│   │   │   ├── 01_schemas.sql         # 4 схемы
│   │   │   └── 02_roles.sql
│   │   ├── models/
│   │   │   ├── auth.py
│   │   │   ├── queue.py
│   │   │   ├── ris.py
│   │   │   ├── audit.py
│   │   │   ├── hl7.py                 # v1.0
│   │   │   ├── schedule.py            # v1.0
│   │   │   └── billing.py             # v1.0
│   │   └── schemas/
│   │       ├── auth.py
│   │       ├── queue.py
│   │       ├── ris.py
│   │       ├── hl7.py                 # v1.0
│   │       ├── schedule.py            # v1.0
│   │       └── billing.py             # v1.0
│   ├── elqueue/                       # Сервис очереди (port 8005)
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── tickets.py
│   │   │   └── notifications.py       # v2.0 (WebSocket)
│   │   └── templates/
│   ├── ris/                           # RIS (port 8000)
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── orders.py
│   │   │   ├── schedule.py            # v1.0
│   │   │   ├── billing.py             # v1.0
│   │   │   └── hl7_admin.py           # v1.0 (просмотр журнала)
│   │   └── templates/
│   ├── dicom_gw/                      # DICOM-шлюз (v1.0)
│   │   ├── __init__.py
│   │   ├── mwl_provider.py
│   │   ├── mpps_receiver.py
│   │   ├── storage_scu.py
│   │   └── ae_titles.py
│   ├── hl7_gw/                        # HL7-шлюз (v1.0)
│   │   ├── __init__.py
│   │   ├── mllp_server.py
│   │   ├── parser.py
│   │   ├── routes/
│   │   │   ├── adt.py
│   │   │   ├── orm.py
│   │   │   └── oru.py
│   │   └── ack.py
│   ├── workers/                       # Celery (v2.0)
│   │   ├── celery_app.py
│   │   └── tasks/
│   │       ├── hl7_retry.py
│   │       ├── notifications.py
│   │       └── backup.py
│   ├── tests/                         # pytest
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_tickets.py
│   │   ├── test_orders.py
│   │   ├── test_mwl.py                # v1.0
│   │   ├── test_hl7.py                # v1.0
│   │   └── e2e/
│   │       └── test_full_workflow.py
│   ├── generate-test-images.py
│   ├── load-test-data.py
│   ├── start.bat
│   ├── .env / .env.example
│   ├── requirements.txt
│   ├── TZ.md
│   ├── REPORT.md
│   ├── README.md
│   └── docker-compose.yml             # PG + Orthanc + Redis
├── frontend/                          # React SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── RegistrationPage.tsx
│   │   │   ├── QueuePage.tsx
│   │   │   ├── DoctorPage.tsx
│   │   │   ├── OrdersPage.tsx
│   │   │   ├── ViewerPage.tsx
│   │   │   ├── ProtocolPage.tsx
│   │   │   ├── SchedulePage.tsx       # v1.0
│   │   │   ├── BillingPage.tsx        # v1.0
│   │   │   ├── PatientPortal.tsx      # v2.0
│   │   │   └── AdminPage.tsx
│   │   ├── components/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── orthanc/                           # Конфиг PACS
│   ├── orthanc.json
│   └── storage/
├── docs/
│   ├── TZ_RIS.md                      # старая версия (для истории)
│   ├── ARCHITECTURE.md
│   ├── USER_GUIDE.md
│   ├── DEV_GUIDE.md
│   ├── TEST_REPORT.md
│   ├── DICOM_INTEGRATION.md           # v1.0
│   ├── HL7_INTEGRATION.md             # v1.0
│   └── DEPLOYMENT.md                  # v1.0
├── .ai-context.md
├── PRACTICE_LOG.md
├── TRACKER.md
└── .git/
```

---

## 15. ИЗВЕСТНЫЕ ОГРАНИЧЕНИЯ

| ID | Описание | Серьёзность | Когда решить |
|---|---|---|---|
| L1 | `ris.orders.id` — 8 hex (риск коллизии при ~65k заказов) | medium | v1.0 → UUID |
| L2 | Frontend на Vanilla JS (не React) | medium | v1.0 (миграция) |
| L3 | DWV не подключён, Canvas-fallback | low | v2.0 |
| L4 | Нет HTTPS, 2FA, rate limiting | high (для prod) | v1.0 |
| L5 | `db/init_db.py` печатает пароль в stdout | medium | доработка (только dev) |
| L6 | Refresh-токены не ротируются | low | v1.0 |
| L7 | Нет DICOM MWL/MPPS — аппарат не получает расписание | high | v1.0 |
| L8 | Нет HL7 — обмен с МИС вручную | high | v1.0 |
| L9 | Нет расписания — слоты не бронируются | high | v1.0 |
| L10 | Нет биллинга — счета не выставляются | high | v1.0 |
| L11 | Нет тестов (pytest) | high | v1.0 |
| L12 | `db/session.py:get_session` и `db/dependencies.py:get_db` дублируют | low | refactor |

---

## 16. АРХИТЕКТУРНЫЕ РЕШЕНИЯ (ADR)

### ADR-002: Выбор PACS-платформы

**Дата:** 2026-06-02
**Статус:** ✅ Принято
**Контекст:** Нужен полноценный PACS для v1.0: DICOM Storage, MWL Provider, MPPS Receiver, DICOMweb.

**Рассмотренные варианты:**

| # | Вариант | Плюсы | Минусы |
|---|---------|-------|--------|
| 1 | **Orthanc + pynetdicom (MWL/MPPS)** | Лёгкий (50 МБ); уже работает в MVP; pynetdicom — нативный Python; не ломаем существующее | Поддержка MWL/MPPS вручную |
| 2 | **dcm4chee** | Production-grade; IHE compliant; всё из коробки; кластеризация | JVM 2-3 ГБ; Wildfly/JBoss; LDAP; сложная конфигурация; 5-7 дней миграции |
| 3 | **Orthanc + плагины (без MWL/MPPS)** | DICOMweb из коробки; быстро | Не даёт MWL/MPPS — аппарат не получает расписание; не выполняет ТЗ v3.0 |
| 4 | **Оставить как есть (MVP)** | 0 дней | Не выполняет ТЗ v3.0 (F5.1, F5.2 — high) |

**Решение:** **Вариант 1 — Orthanc + pynetdicom.**

**Обоснование:**
1. **Минимизация рисков** — Orthanc уже работает, Storage закрыт, не мигрируем
2. **Соответствие стеку** — pynetdicom — Python, интегрируется с FastAPI/asyncpg; не добавляем Java/JVM
3. **Полнота ТЗ** — закрывает F5.1, F5.2, F5.3, F5.4 из ТЗ v3.0
4. **Срок** — 3-4 дня (vs 5-7 у dcm4chee)
5. **Демо-готовность** — запуск `python -m dicom_gw` + работающий Orthanc проще показать на защите, чем Wildfly + LDAP
6. **Соразмерность** — для 1 больницы / до 100 исследований в день Orthanc достаточен (dcm4chee избыточен)

**Сценарии, в которых решение пересматривается:**
- > 5 PACS в федерации → dcm4chee + IHE XDS
- > 10 000 исследований/день → dcm4chee + кластер
- > 10 параллельных C-STORE → Orthanc с PostgreSQL storage + load balancer

**Следствие для кода:**
- Создать модуль `dicom_gw/` с MWL Provider (C-FIND SCP), MPPS Receiver (N-CREATE/N-SET SCP), Storage SCU (опционально)
- Alembic-миграция: `ris.orders.scheduled_at TIMESTAMPTZ`, `ris.orders.mpps_status VARCHAR(20)`, `ris.orders.accession_number VARCHAR(20)`
- Endpoint `POST /api/v1/orders/{id}/schedule` (назначить слот)
- Frontend: страница `/schedule` с календарём
- Тест: `findscu -k "(0010,0010)=*" localhost 11112` → получает RIS-заказы

---

## ПРИЛОЖЕНИЕ А. Команды для запуска

### MVP (есть)
```powershell
python -m pip install -r requirements.txt
psql -U pacs -d pacs_ris -f db/init/01_schemas.sql
psql -U pacs -d pacs_ris -f db/init/02_roles.sql
alembic upgrade head
python -m db.init_db
& "C:\Program Files\Orthanc Server\Orthanc.exe"
python generate-test-images.py
$env:PYTHONIOENCODING="utf-8"
python -m uvicorn ris.main:app --port 8000
python -m uvicorn elqueue.main:app --port 8005
```

### v1.0 (план)
```powershell
# Запуск всего стека через Docker Compose
docker compose up -d          # PostgreSQL, Orthanc, Redis
alembic upgrade head          # Миграции
python -m db.init_db          # Seed
python -m uvicorn ris.main:app --port 8000
python -m uvicorn elqueue.main:app --port 8005
python -m dicom_gw            # DICOM MWL+MPPS+Storage SCU
python -m hl7_gw              # MLLP-сервер
cd frontend && npm run dev    # Vite dev-server
```

### Тест DICOM (v1.0)
```powershell
# C-ECHO
storescu -aec MEDPLATFORM localhost 11114

# C-FIND MWL
findscu -aec MEDPLATFORM_MWL -k "(0010,0010)=*" localhost 11112

# Отправка снимка
storescu -aec ORTHANC localhost 4242 test.dcm
```

### Тест HL7 (v1.0)
```bash
# Отправка ADT^A01 через netcat
echo -ne 'MSH|...|ADT^A01|...|PID|...|EVN|A01|...\r' | nc localhost 6661
```

---

## ПРИЛОЖЕНИЕ Б. Переменные окружения

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Runtime DSN (pacs_app) |
| `DATABASE_MIGRATION_URL` | Alembic DSN (pacs_migrator) |
| `DATABASE_SYNC_URL` | Sync DSN (psycopg v3) |
| `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_*_TTL` | JWT настройки |
| `ORTHANC_URL` | URL PACS |
| `RIS_URL`, `ELQUEUE_URL` | URL сервисов |
| `DICOM_MWL_PORT=11112` | DICOM MWL SCP port |
| `DICOM_MPPS_PORT=11113` | DICOM MPPS SCP port |
| `DICOM_AE_TITLE=MEDPLATFORM` | AE Title нашего MWL/MPPS |
| `HL7_MLLP_PORT=6661` | HL7 MLLP-сервер port |
| `HL7_MIS_HOST`, `HL7_MIS_PORT` | Куда слать ORU |
| `REDIS_URL=redis://localhost:6379/0` | Брокер (v2.0) |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Email-уведомления (v2.0) |
| `SMS_API_KEY` | SMS-шлюз (v2.0) |

---

## ПРИЛОЖЕНИЕ В. Глоссарий DICOM/HL7

**DICOM SOP Classes (для интеграции):**
- `1.2.840.10008.5.1.4.31` — Modality Worklist Information Model – FIND
- `1.2.840.10008.3.1.2.3.3` — Modality Performed Procedure Step SOP
- `1.2.840.10008.5.1.4.1.1.2` — CT Image Storage
- `1.2.840.10008.5.1.4.1.1.4` — MR Image Storage
- `1.2.840.10008.5.1.4.1.1.1` — Computed Radiography Image Storage

**HL7 v2.5 сегменты (для интеграции):**
- `MSH` — Message Header
- `EVN` — Event Type
- `PID` — Patient Identification
- `PV1` — Patient Visit
- `OBR` — Observation Request (заказ)
- `OBX` — Observation/Result (результат)
- `MSA` — Message Acknowledgment (AA/AE/AR)

---

**СОГЛАСОВАНО:**

| Роль | ФИО | Подпись | Дата |
|------|-----|---------|------|
| Руководитель практики | ________ | _____ | ______ |
| Исполнитель | ________ | _____ | 02.06.2026 |

---
