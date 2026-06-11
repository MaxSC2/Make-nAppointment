# ПОЛНЫЙ КОНТЕКСТ ПРОЕКТА RIS-PACS-Queue
# Читай этот файл ПОЛНОСТЬЮ перед любым действием

---

## КТО ТЫ И ЧТО ДЕЛАЕШЬ

Ты — AI-ассистент студента-разработчика на производственной практике.
Студента зовут Макс. Он фронтенд-разработчик в команде из 6 человек.
Проект учебный но реалистичный. Срок — до конца практики (~2 недели).
Цель — рабочий MVP и красивое демо, не идеальный продукт.

---

## ЧТО ТАКОЕ ЭТОТ ПРОЕКТ

РИС (Радиологическая Информационная Система) — веб-интерфейс для врача-радиолога
где в одном месте собрано:
- Кто сейчас в очереди на исследование
- Какие заказы на снимки назначены пациентам
- Сами DICOM-снимки с просмотром в браузере
- История всех исследований каждого пациента

Аналог в индустрии: Philips Workflow Information Management (Vue PACS + RIS).

---

## РЕАЛЬНОЕ СОСТОЯНИЕ ПРОЕКТА (актуально на 08.06.2026)

**Путь:** `C:\Projects\ARCHIVE\MedPlatform\`
**Git:** master, 11 коммитов, remote: Make-nAppointment.git
**Тип:** гибрид Next.js 15 (корень, MedPlatform — архив) + Vite 8 (frontend/) + FastAPI × 2 (backend/)

### Что работает ✅
- 8770 DICOM-исследований в Orthanc
- PostgreSQL 16 с 13 таблицами (4 схемы: auth, queue, ris, audit)
- RIS бэкенд FastAPI (порт 8000) — 15+ эндпоинтов
- Elqueue бэкенд FastAPI (порт 8005) — очередь пациентов
- Orthanc PACS (порт 8042 HTTP, 4242 DICOM)
- PACS-фасад оптимизирован: 3s → 46ms (кэш + батч-запросы)
- 8 страниц фронта: Login, Queue, Registration, Doctor, Orders, Studies, Viewer, Protocol
- JWT авторизация с refresh-токенами
- Vite proxy для всех сервисов

### Чего не хватает ❌
- PatientsPage — список пациентов с поиском
- PatientCardPage — карточка пациента с историей снимков
- OrderEntryPage — форма назначения исследования врачом
- Связь DoctorPage → карточка пациента

### Известные баги ⚠️
- /dicom-files proxy без JWT (дыра безопасности — пока не критично для демо)
- CORS может быть не настроен на обоих бэкендах

---

## ИНФРАСТРУКТУРА — БЕЗ ДОКЕРА

PostgreSQL, Orthanc запущены напрямую на Windows-машине (не в Docker).

**Как запустить сервисы:**
```bash
# Терминал 1 — RIS бэкенд
cd C:\Projects\ARCHIVE\MedPlatform\backend\ris
uvicorn main:app --reload --port 8000

# Терминал 2 — Очередь
cd C:\Projects\ARCHIVE\MedPlatform\backend\elqueue
uvicorn main:app --reload --port 8005

# Терминал 3 — Фронт
cd C:\Projects\ARCHIVE\MedPlatform\frontend
npm run dev
```

**Проверка что всё работает:**
- `http://localhost:8000/docs` — Swagger RIS
- `http://localhost:8005/docs` — Swagger Elqueue
- `http://localhost:5173` — фронт
- `http://localhost:8042` — Orthanc Explorer

**Тестовые учётки:**
- admin / admin123 (роли: admin)

---

## ТЕХНОЛОГИЧЕСКИЙ СТЕК — ТОЧНЫЕ ВЕРСИИ

### Frontend (зона Макса):
| Технология | Версия | Важно |
|---|---|---|
| React | 19.2.6 | НЕ 18, именно 19 |
| Vite | 8.0.12 | НЕ Next.js |
| TypeScript | 6.0.2 | Строгая типизация, без any |
| Tailwind CSS | 4.3.0 | CSS-first, через Vite-плагин |
| React Router | 7.16.0 | НЕ v6 — v7! |
| DWV | 0.36.3 | DICOM-вьювер |
| Konva | 9.3.20 | Для рисования на снимках |

### Backend:
| Технология | Версия |
|---|---|
| Python | 3.14.3 |
| FastAPI | актуальная |
| SQLAlchemy | 2.0.36 async |
| PostgreSQL | 16 |
| Orthanc | 1.12+ |

### Чего НЕТ в проекте:
- НЕТ Docker (сервисы запущены напрямую)
- НЕТ shadcn/ui
- НЕТ Zustand / Redux
- НЕТ TanStack Query
- НЕТ MSW

---

## СТРУКТУРА ПРОЕКТА

```
C:\Projects\ARCHIVE\MedPlatform\
├── backend/
│   ├── ris/                      # RIS сервис (порт 8000)
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── auth.py           # POST login/refresh/logout, GET me
│   │   │   ├── orders.py         # GET/POST orders, статусы, протоколы
│   │   │   ├── studies.py        # /api/v1/* — PACS-фасад эндпоинты
│   │   │   └── dicomweb.py       # /dicom/* — QIDO-RS/WADO-RS прокси
│   │   └── services/
│   │       └── pacs_facade.py    # 593 строки — вся логика работы с Orthanc
│   │
│   └── elqueue/                  # Сервис очереди (порт 8005)
│       ├── main.py
│       └── routers/
│           ├── auth.py
│           └── tickets.py        # Все эндпоинты очереди
│
├── frontend/                     # React SPA (порт 5173)
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.tsx     ✅ готово
│       │   ├── QueuePage.tsx     ✅ готово
│       │   ├── RegistrationPage.tsx ✅ готово
│       │   ├── DoctorPage.tsx    ✅ готово (нужна доработка)
│       │   ├── OrdersPage.tsx    ✅ готово
│       │   ├── StudiesPage.tsx   ✅ готово
│       │   ├── ViewerPage.tsx    ✅ готово
│       │   ├── ProtocolPage.tsx  ✅ готово
│       │   ├── PatientsPage.tsx  ❌ НУЖНО СОЗДАТЬ
│       │   ├── PatientCardPage.tsx ❌ НУЖНО СОЗДАТЬ
│       │   └── OrderEntryPage.tsx ❌ НУЖНО СОЗДАТЬ
│       │
│       ├── components/
│       │   ├── Layout.tsx        ✅ есть — хедер, навигация
│       │   ├── DwvViewer.tsx     ✅ есть — НЕ ТРОГАТЬ
│       │   ├── StatusBadge.tsx   ✅ есть — использовать
│       │   ├── QueueTable.tsx    ✅ есть
│       │   └── OrderCard.tsx     ✅ есть
│       │
│       ├── api/
│       │   ├── client.ts         ✅ базовый HTTP-клиент с JWT
│       │   ├── queue.ts          ✅ 7 функций для очереди
│       │   └── ris.ts            ✅ 10+ функций для RIS и PACS
│       │
│       ├── hooks/
│       │   ├── useQueue.ts       ✅ автообновление каждые 10 сек
│       │   └── useOrders.ts      ✅ с фильтром по статусу
│       │
│       └── types/
│           ├── auth.ts           ✅ UserOut, TokenPair
│           ├── queue.ts          ✅ CabinetOut, PatientOut, TicketOut...
│           ├── ris.ts            ✅ OrderOut, StudyListItem, StudyOut...
│           └── dwv.d.ts          ✅ декларации DWV
│
└── (корень) Next.js 15           # MedPlatform — архив первого этапа
    └── app/                      # НЕ ТРОГАТЬ — это архив
```

---

## БАЗА ДАННЫХ — СХЕМЫ И ТАБЛИЦЫ

```sql
-- Схема auth
auth.roles        -- admin, doctor, registrar, technician
auth.users        -- username, email, bcrypt hash
auth.user_roles   -- M2M связь
auth.refresh_tokens

-- Схема queue
queue.cabinets    -- 101:КТ, 102:МРТ, 103:Рентген, 104:УЗИ
queue.patients    -- UUID, full_name, policy_number, birth_date, phone
queue.tickets     -- ticket_number, status, FK→patient, FK→cabinet, order_id
queue.ticket_events

-- Схема ris
ris.modalities    -- CT, MR, DX, US, XA, MG, PT, NM
ris.orders        -- 8-hex ID, FK→patient, modality, study_uid, status
ris.studies       -- FK→order, orthanc_id, series_count, instance_count
ris.protocols     -- FK→order, body, impression, is_draft, signed_at

-- Схема audit
audit.audit_log   -- user_id, action, resource_type, IP, JSONB extra
```

**Важно:** таблица `queue.patients` уже существует со всеми нужными полями!

---

## API ЭНДПОИНТЫ

### RIS сервис (порт 8000)

**Авторизация:**
```
POST /api/auth/login    → { access_token, refresh_token }
POST /api/auth/refresh  → { access_token }
POST /api/auth/logout
GET  /api/auth/me       → UserOut
```

**Заказы:**
```
GET  /api/orders              → OrderOut[]
POST /api/orders              → создать заказ
GET  /api/orders/{id}         → OrderOut
PATCH /api/orders/{id}        → обновить статус
GET  /api/modalities          → ModalityOut[]
```

**PACS-фасад /api/v1/ (главное для новых страниц):**
```
GET  /api/v1/studies                    → StudyListItem[] (список всех исследований)
GET  /api/v1/studies/{uid}              → StudyOut (детали)
GET  /api/v1/studies/{uid}/preview      → PNG превью снимка
GET  /api/v1/instances/{id}/dicom       → DICOM файл для DWV
GET  /api/v1/patients                   → PatientOut[] (проверь наличие!)
GET  /api/v1/patients/{id}              → PatientOut
GET  /api/v1/patients/{id}/studies      → StudyListItem[]
```

### Elqueue сервис (порт 8005)
```
GET  /api/cabinets            → CabinetOut[]
GET  /api/tickets             → TicketOut[]
POST /api/tickets             → регистрация пациента + создание заказа в RIS
GET  /api/tickets/{n}         → TicketDetail
GET  /api/tickets/{n}/events  → TicketEventOut[]
POST /api/tickets/next        → вызвать следующего (FIFO)
POST /api/tickets/{n}/complete → завершить приём
```

**Как проверить все эндпоинты:** `http://localhost:8000/docs`

---

## TYPESCRIPT ТИПЫ (актуальные)

```typescript
// types/queue.ts — уже есть
export interface PatientOut {
  id: string           // UUID
  full_name: string
  policy_number: string
  birth_date: string
  phone: string
}

export interface CabinetOut { id: number; code: string; name: string; modality: string }
export type TicketStatus = 'waiting' | 'in_progress' | 'done' | 'cancelled'
export interface TicketOut {
  id: number
  ticket_number: string
  status: TicketStatus
  patient: PatientOut
  cabinet: CabinetOut
  order_id: string
  created_at: string
}

// types/ris.ts — уже есть
export type OrderStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type Modality = 'CT' | 'MR' | 'DX' | 'US' | 'XA' | 'MG' | 'PT' | 'NM'

export interface OrderOut {
  id: string
  patient: PatientOut
  modality: ModalityOut
  study_uid: string
  status: OrderStatus
  created_at: string
  updated_at: string
}

export interface StudyListItem {
  study_uid: string
  orthanc_id: string
  patient_name: string
  patient_id_dicom: string
  study_date: string
  modality: string
  series_count: number
  instance_count: number
  order_id?: string
  order_status?: OrderStatus
  preview_url: string    // /api/v1/studies/{uid}/preview
}
```

---

## ПАТТЕРН РАБОТЫ С ДАННЫМИ — ОБЯЗАТЕЛЬНЫЙ

```typescript
// Шаблон для каждой страницы:
const [data, setData] = useState<T | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  let cancelled = false
  setLoading(true)
  setError(null)

  fetchSomething()
    .then(result => { if (!cancelled) setData(result) })
    .catch(err => { if (!cancelled) setError(err.message) })
    .finally(() => { if (!cancelled) setLoading(false) })

  return () => { cancelled = true }
}, [dependency])

// Рендер:
if (loading) return <div className="p-8 text-center text-gray-500">Загрузка...</div>
if (error) return (
  <div className="p-8 text-center">
    <p className="text-red-600 mb-4">{error}</p>
    <button onClick={() => setData(null)} className="text-teal-600 underline">Повторить</button>
  </div>
)
```

---

## ЦВЕТА И СТИЛИ (Tailwind)

```
Акцент:          teal-600 (#0D9488) — кнопки, ссылки, активные элементы
Фон страницы:    gray-50
Карточки:        white, border border-gray-200, rounded-lg
Текст основной:  gray-900
Текст вторичный: gray-500
Ошибка:          red-600
Успех:           green-600
Предупреждение:  amber-500
```

**Существующие компоненты — использовать, не дублировать:**
```typescript
<StatusBadge status="waiting" />     // жёлтый Ожидает
<StatusBadge status="in_progress" /> // синий В процессе
<StatusBadge status="completed" />   // зелёный Завершено
<StatusBadge status="scheduled" />   // серый Назначено
```

---

## VITE PROXY (vite.config.ts)

```typescript
proxy: {
  '/elqueue': 'http://localhost:8005',
  '/ris':     'http://localhost:8000',
  '/api/v1':  'http://localhost:8000',
  '/dicom':   'http://localhost:8042/dicom-web/'
}
```

Значит в коде:
- `fetch('/ris/api/orders')` → идёт на порт 8000
- `fetch('/api/v1/studies')` → идёт на порт 8000
- `fetch('/elqueue/api/tickets')` → идёт на порт 8005

---

## ПРОИЗВОДИТЕЛЬНОСТЬ PACS-ФАСАДА

Не трогай `pacs_facade.py` — он уже оптимизирован:

| Эндпоинт | До | После |
|---|---|---|
| GET /api/v1/studies | ~2-3s | 14-35ms |
| GET /api/v1/studies/{uid} | ~3s | 46-65ms |
| QIDO-RS /dicom/studies | — | 26ms (8770 исследований) |

Ключевые оптимизации уже сделаны:
- In-memory кэш study_uid→orthanc_id (TTL 60с)
- Батч-запросы вместо N+1
- Semaphore 8 параллельных запросов к Orthanc
- httpx connection pool

---

## ПРАВИЛА — ЧТО ДЕЛАТЬ И НЕ ДЕЛАТЬ

**ДЕЛАТЬ:**
- Проверять через Swagger (`/docs`) что эндпоинт существует перед использованием
- Использовать существующие компоненты (StatusBadge, QueueTable, OrderCard)
- Всегда обрабатывать loading / error / data
- TypeScript везде, без any
- Добавлять запись в PRACTICE_LOG.md после каждой задачи

**НЕ ДЕЛАТЬ:**
- НЕ трогать DwvViewer.tsx — он работает
- НЕ трогать pacs_facade.py — он оптимизирован
- НЕ переписывать существующие страницы с нуля
- НЕ менять схему БД без крайней необходимости
- НЕ создавать дубли существующих компонентов
- НЕ трогать корневой Next.js (MedPlatform архив)

---

## ФОРМАТ ОТВЕТА НА КАЖДЫЙ ЗАПРОС

1. Решаешь задачу / пишешь код
2. В конце обязательно:

```
📝 ЛОГ (скопируй в PRACTICE_LOG.md):
─────────────────────────────────────
### [ДД.ММ.ГГГГ] — [название задачи]
**Что сделано:** ...
**Файлы:** ...
**Технологии:** ...
**Решение:** ...
**Трудности:** ...
**Связь с отчётом:** П.X
─────────────────────────────────────
```

Если задача мелкая: `📝 Лог: не требуется`

---

## ПРИОРИТЕТЫ ЗАДАЧ

### 🔴 Сделать обязательно (нужно для демо):
1. PatientsPage — список пациентов с поиском
2. PatientCardPage — карточка с историей снимков
3. Маршруты и навигация для новых страниц

### 🟡 Сделать если успеваем:
4. OrderEntryPage — форма назначения исследования
5. Добавить кнопку "Карта пациента" в DoctorPage
6. Исправить CORS если мешает

### 🟢 Бонус:
7. ИИ-саммари по пациенту через Gemini API
8. Превью снимка прямо в строке очереди

---

## РЕФЕРЕНСНЫЕ ПРОЕКТЫ (смотри перед реализацией)

- DWV + React официальный пример: `https://github.com/ivmartel/dwv-react`
  (src/DwvComponent.jsx — как инициализировать DWV)
- Radiology Worklist React+TS: `https://github.com/1brahimmohamed/Radiology-Worklist`
  (папка cli/ — структура фронта)
- Orthanc API документация: `https://orthanc.uclouvain.be/api/`
- Тестовые DICOM файлы: `https://www.dicomlibrary.com`

---

## КОНТЕКСТ ДЛЯ ОТЧЁТА

Дневник ведётся в PRACTICE_LOG.md. Все 10 пунктов силлабуса закрыты.
Продолжай дописывать записи по ходу работы — это важно для отчёта.

Смена проекта MedPlatform → RIS описана в логе как плановый второй этап.
Оба проекта засчитываются в отчёт.
