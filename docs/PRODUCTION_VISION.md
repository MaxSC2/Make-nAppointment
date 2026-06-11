# PRODUCTION VISION — MedPlatform PACS-RIS

## От MVP к промышленной РИС

> **Дата:** 11.06.2026
> **Статус:** Vision-документ (план вывода в продуктивную эксплуатацию)

---

## 1. Текущая архитектура (MVP)

```
Браузер (React SPA, :5173)
   │ JWT
   ▼
Vite Proxy
   │
   ├── /elqueue → elqueue (:8005, FastAPI)
   │                 └── tickets, cabinets, patients
   │
   └── /ris     → RIS (:8000, FastAPI)
                    ├── /api/*          — заказы, протоколы, модальности
                    ├── /api/v1/*       — PACS-фасад (список, превью, DICOM)
                    └── PACS-фасад ──→ Orthanc (:8042)
                                           └── 8770 DICOM, 55 исследований
```

**Что уже реализовано:** JWT + RBAC, регистрация, очередь (3 статуса), заказы RIS, протоколы, DICOM-viewer (DWV), PACS-фасад, аудит, 115 тестов.

---

## 2. Целевая архитектура (Production)

```
                    ┌─────────────────────────────────────────┐
                    │            Единый UI врача               │
                    │     MedPlatform React SPA (:5173)        │
                    │  (React 19 + TanStack Query + Zustand)   │
                    └────────────────┬────────────────────────┘
                                     │ JWT
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │      Интеграционный хаб — RIS (:8000)    │
                    │           FastAPI + Pydantic             │
                    └──────┬──────┬──────┬──────┬──────────────┘
                           │      │      │      │
              ┌────────────┘      │      │      └──────────────┐
              ▼                    ▼      ▼                     ▼
    ┌──────────────────┐  ┌────────────┐  ┌───────────────────────┐
    │  SmartQ (NestJS)  │  │  PACS-     │  │  Внешние системы      │
    │  :3000             │  │  фасад     │  │                       │
    │  Эл. очередь       │  │            │  │  HL7 MLLP (:6661)     │
    │  WebSocket         │  │  Orthanc   │  │  ──→ ЛПУ, Больницы    │
    │  Приоритеты 1-5    │  │  :8042     │  │                       │
    │  ETA / Аналитика   │  │  8770      │  │  DICOM MWL (:11112)   │
    │  Табло (Board)     │  │  снимков   │  │  ──→ КТ/МРТ/Рентген   │
    │  Терминалы (kiosk) │  │            │  │                       │
    └──────────────────┘  └────────────┘  │  DICOM MPPS (:11113)   │
                                          │  ──→ Статусы сканир.   │
                                          └───────────────────────┘
```

---

## 3. Что нужно для Production (по слоям)

### 3.1. Электронная очередь — заменить elqueue на SmartQ

SmartQ уже закончен — NestJS + Prisma + Socket.IO + Recharts. Всё что нужно уже есть:

| Функция | SmartQ | Наш elqueue |
|---|---|---|
| Статусная машина | 8 статусов (created→waiting→called→in_service→completed/cancelled/no_show/redirected) | 3 статуса (waiting→in_progress→done) |
| Приоритеты | 1-5 (critical, high, above_normal, normal, low) | Нет |
| ETA (время ожидания) | ✅ | Нет |
| WebSocket realtime | ✅ Socket.IO | Нет (polling 10s) |
| Табло (Board) | ✅ | Нет |
| Аналитика | ✅ Recharts (периоды, загрузка, среднее время) | Нет |
| Kiosk (терминал) | ✅ POST /tickets/kiosk | Нет |
| i18n (каз/рус/англ) | ✅ | Нет |
| Аудио (на казахском) | ✅ | Нет |
| Печать талона | ✅ TicketPrintPreview | Нет |

**План интеграции (уже есть):** `docs/SMARTQ_INTEGRATION_PLAN.md`

### 3.2. PACS-слой

| Компонент | Что нужно сделать |
|---|---|
| **MWL Provider** (порт 11112) | pynetdicom SCP — модальности получают Worklist пациента |
| **MPPS Receiver** (порт 11113) | pynetdicom SCP — статусы сканирования (in_progress → completed) |
| **DICOM-шлюз** | Приём DICOM напрямую от модальностей (C-STORE SCP) |
| **Хранилище Hot/Cold** | Orthanc на SSD (active <30д) → сжатие JPEG-LS → NAS/S3 (архив) |
| **Multi-panel синхронизация** | Замена DWV на OHIF Viewer или коммерческий вьювер |
| **3D Volume Rendering** | OHIF + Cornerstone3D (пока не支持ит DWV 0.36) |

### 3.3. Интеграции (HL7/FHIR)

| Протокол | Назначение |
|---|---|
| **HL7 v2 MLLP** (порт 6661) | Обмен заказами с ЛПУ: ADT (пациенты), ORM (заказы), ORU (результаты) |
| **FHIR R4** (REST) | Современный API для EMR/EHR систем |
| **SCP-ECG** | ЭКГ (если требуется) |

### 3.4. ИИ-ассистент

| Компонент | Технология |
|---|---|
| **Сегментация патологий** | ONNX Runtime — локальные модели (например, MONAI) |
| **Черновик протокола** | VLM (LLaVA / GPT-4V) — генерация Impression по снимкам |
| **Pipeline** | POST /api/v1/studies/{uid}/ai-analyze → async task → callback |
| **API-контракт** | Уже спроектирован в SYSTEM_ANALYSIS.md |

### 3.5. Фронтенд — уроки из SmartQ

SmartQ фронтенд (React + TanStack Query + Zustand + Socket.IO + Recharts) показывает что нужно:

| Что взять | Почему |
|---|---|
| **TanStack Query** (React Query) | Кэширование, ревалидация, retry, вместо ручных useState/useEffect |
| **Zustand** вместо Context | Меньше boilerplate, нет лишних ререндеров |
| **Socket.IO** вместо polling | Мгновенные обновления очереди, меньше нагрузки на сервер |
| **Service Layer** (ticketService, queueService) | Чёткое разделение, тестируемость |
| **Board/Tablo** | Экран для пациентов в холле (WebSocket) |
| **Kiosk (киоск)** | Саморегистрация пациентов через терминал |
| **i18n (каз/рус/англ)** | Обязательно для РК |
| **Recharts** | Дашборд с графиками загрузки врачей |

### 3.6. Безопасность и compliance

| Требование | Что нужно |
|---|---|
| **CORS whitelist** | Заменить `*` на конкретные домены |
| **Rate limiting** | slowapi / nginx rate limit |
| **HTTPS** | Let's Encrypt + reverse proxy (Caddy/nginx) |
| **HIPAA / GDPR** | Audit log (есть), encryption at rest, access control, BAA |
| **Резервное копирование** | pg_dump (БД) + Orthanc backup (DICOM) |
| **Monitoring** | Prometheus + Grafana (ELK для логов) |

### 3.7. Инфраструктура

| Компонент | Текущее | Целевое |
|---|---|---|
| **Оркестрация** | start-all-services.bat (bare metal) | Docker Compose → Kubernetes |
| **PostgreSQL** | :5432 (общая) | :5432 + реплика read-only |
| **Orthanc** | :8042 + :4242 | Кластер Orthanc + hot/cold storage |
| **Caching** | Нет | Redis (сессии, кэш DICOM-тегов) |
| **CDN** | Нет | Cloudflare / nginx для статики |
| **CI/CD** | Нет | GitHub Actions → Docker → deploy |

---

## 4. Roadmap

### Фаза 1 (текущая — MVP) — сделано
- Сквозной сценарий: регистрация → очередь → врач → DICOM
- JWT + RBAC, PACS-фасад, DWV-вьювер
- 115 тестов, 0 ошибок TS

### Фаза 2 (1-2 недели) — SmartQ интеграция
- Замена elqueue на SmartQ (прокси-роутер в RIS)
- WebSocket для очереди (вместо polling)
- Табло (Board) для холла
- i18n каз/рус/англ

### Фаза 3 (1 месяц) — PACS-инфраструктура
- DICOM MWL Provider (pynetdicom, порт 11112)
- DICOM MPPS Receiver (pynetdicom, порт 11113)
- HL7 MLLP-сервер (python-hl7, порт 6661)
- Hot/cold tiering (автоархивация >30 дней)
- Масштабирование Orthanc (несколько узлов)

### Фаза 4 (2-3 месяца) — ИИ и прод
- AI-ассистент (сегментация + генерация протокола)
- OHIF Viewer (multi-panel, 3D)
- CORS whitelist, HTTPS, rate limiting
- Docker Compose production-ready
- Prometheus + Grafana мониторинг

### Фаза 5 (6+ месяцев) — Enterprise
- FHIR R4 API
- Kubernetes
- HIPAA/GDPR compliance
- Масштабирование на несколько ЛПУ

---

## 5. Связи компонентов

```
SmartQ (NestJS :3000)
  │ POST /tickets/kiosk        ← Kiosk (саморегистрация)
  │ WebSocket /queue            ← Board (табло в холле)
  │ WebSocket /status           ← Specialist panel (врач)
  │
  ├── Webhook → RIS POST /api/hooks/smartq/event
  │              └── source_ticket_id → Order.source_ticket_id
  │
  └── REST ← RIS GET /api/queue/*
                     └── прокси к SmartQ

RIS (FastAPI :8000)
  ├── PACS-фасад ──→ Orthanc :8042
  │                    └── Hot : SSD (active <30d)
  │                    └── Cold : S3/NAS (сжатый JPEG-LS)
  │
  ├── MWL (:11112) ←── Модальности (КТ, МРТ, Рентген)
  ├── MPPS (:11113) ←── Статусы сканирования
  ├── HL7 (:6661)  ←── ЛПУ (ADT, ORM, ORU)
  │
  └── AI Worker (async)
       ├── ONNX → Сегментация
       └── VLM  → Черновик протокола
```

---

## 6. Что можно показать на демо уже сейчас

1. **Сквозной сценарий**: от регистрации до просмотра DICOM — работает полностью
2. **Тесты**: 115/115 pass, TSC 0 errors
3. **Orthanc**: 8770 реальных снимков, 55 исследований
4. **DWV**: JPEG-LS кодеки работают, scroll, W/L, zoom
5. **SmartQ**: код доступен, модель данных готова, план интеграции есть
6. **Архитектура**: PACS-фасад скрывает Orthanc, JWT на всех эндпоинтах
7. **Vision**: hot/cold tiering спроектирован, AI-контракт спроектирован, multi-panel vision есть

---

## 7. Референс: SmartQ (что даёт интеграция)

Изучив SmartQ (NestJS + React + TanStack Query + Zustand + Socket.IO) в качестве референса:

**Что перенять в RIS:**
- Zustand (store) вместо Context — проще, быстрее, без Provider-ов
- TanStack Query для API-запросов — кэш, retry, invalidation
- Service Layer паттерн (ticketService/queueService) — чистая архитектура
- Recharts для дашбордов — аналитика загрузки врачей
- Socket.IO для Board/табло — реальное время

**Что SmartQ не покрывает:**
- PACS/DICOM — у SmartQ нет работы со снимками
- Протоколы исследований — только наш RIS
- HL7/FHIR интеграция — только в нашем RIS
- AI-анализ — только в нашем vision
