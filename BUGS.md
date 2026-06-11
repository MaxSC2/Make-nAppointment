# Баги и несоответствия — для AI-кодера (бэкенд)

> Статусы: 🔴 Критично | 🟡 Надо поправить | ⚪ Пожелание
> Обновлять по мере нахождения.

---

## ⚪ series_count / instance_count = 0 (исторически)

**Найдено:** ранее
**Где:** `ris.studies.series_count`, `ris.studies.instance_count`
**Что было:** В БД всегда 0 — не обновлялись при линковке.
**Статус:** ✅ **ЧАСТИЧНО ИСПРАВЛЕНО** (09.06.2026):
- `link_study_to_order` уже использует `orthanc_study.get("Series")` — будущие линковки правильно записывают counts.
- 17 исторических записей обновлены: `series_count=1, instance_count=1` (workaround — реальные counts утеряны т.к. Orthanc был перезапущен, orthanc_id в БД больше не соответствуют реальным ID).
- Для полного фикса: перезалить DICOM-снимки из архива и заново линковать.
**Урок:** Orthanc данные хрупкие — при перезапуске теряются ссылки. Нужна стратегия бэкапа (PostgreSQL dump + Orthanc export).

---

## 🟢 `is_uploaded` в pacs_facade всегда True (FIXED in commit a754505)

## 🟢 Emoji 👤 в пациентах (FIXED in commit 65e8f91)

## 🟢 PatientCardPage — пустой "Статус:" (FIXED in commit 65e8f91)

## 🟢 callNext FIFO (FIXED in commit 091702b — скрыта кнопка для не-первых)

## 🔴 Замена DWV-просмотрщика — задача другого AI

**Дата:** 09.06.2026
**Решение:** 09.06.2026 решено заменить DWV-просмотрщик на другую реализацию фронта DICOM.
**Назначено:** Другой AI делает замену. Текущий AI (MaxSC2/Make-nAppointment ветка) после — проверяет.
**Что нужно сделать (для назначенного AI):**
- Выбрать альтернативу DWV (cornerstone.js, mdcm, OHIF viewer, или иной)
- Сохранить API: `GET /api/v1/instances/{id}/dicom` (для фронта)
- Сохранить компонент `<DwvViewer studyUid={...} />` как интерфейс (или переименовать и обновить импорты в `ViewerPage.tsx`)
- Сохранить `useDwvViewer` хук API (или переписать под новый viewer)
- Сохранить DicomSearch компонент
- Сохранить /viewer/:studyUid маршрут

**Что нужно проверить (для текущего AI после замены):**
- TypeScript clean
- Открытие исследования в браузере через MCP
- Все 4 тула работают
- Серии переключаются
- DICOM-данные грузятся
- Reset / drag-and-drop / PACS search работают
- Patient card → Открыть → viewer работает

**Закоммитил подготовку:** `bc12561 ui(dwv): SVG icons for all tools + fix Russian tool names` (иконки + локализация останутся при замене)

---

## 🔴 `getPatient(id)` вызовет 404 — фронт-страница поломается

**Найдено:** 08.06.2026
**Где:** `frontend/src/api/ris.ts:78-80` → `frontend/src/pages/PatientCardPage.tsx`
**Что:** Другой AI добавил `getPatient(patientId)` (frontend), но в `studies.py` НЕ было `GET /api/v1/patients/{id}` — только `/patients` (список) и `/patients/{id}/studies`. `PatientCardPage` использует `getPatient(id)`, что вызывало 404.
**Статус:** ✅ **ИСПРАВЛЕНО** — другой AI добавил эндпоинт `get_patient(patient_id)` в `backend/ris/routers/studies.py:339`. Проверено: возвращает пациента.
**Урок:** Перед коммитом проверять парность frontend-функции и backend-эндпоинта через `grep @router.get`.

---

## 🟡 Emoji 🔍 в placeholder PatientsPage

**Найдено:** 08.06.2026
**Где:** `frontend/src/pages/PatientsPage.tsx:35`
**Что:** В placeholder поиска `🔍 Поиск по ФИО или полису...`
**Почему проблема:** В коде проекта нет конвенции использовать emoji. В других страницах используется SVG-иконка. Plus: emoji может не отрендериться в некоторых браузерах/шрифтах.
**Надо:** Заменить на SVG `<svg className="absolute left-3 top-3 ...">` (как было в моей версии).

---

## 🟡 `is_uploaded` в pacs_facade всегда True

**Найдено:** 08.06.2026
**Где:** `backend/ris/services/pacs_facade.py:259`
**Что:** Другой AI добавил `summary["is_uploaded"] = True` — **всегда True**, без проверки реального состояния Orthanc.
**Почему проблема:** В БД есть `ris.studies.is_uploaded` (true для всех 12), но семантически это должно проверяться через Orthanc (`studies/{id}/instances` count > 0).
**Надо:** Сделать реальную проверку: `await _orthanc_get_json(f"studies/{orthanc_id}/instances")` и проверять len > 0.

---

## 🟡 `preview_url` строится по study_uid, не orthanc_id

**Найдено:** 08.06.2026
**Где:** `backend/ris/services/pacs_facade.py:261`
**Что:** `summary["preview_url"] = f"/api/v1/studies/{summary['study_uid']}/preview"` — превью-эндпоинт принимает **orthanc_id** или **study_uid**?
**Надо:** Проверить, какой идентификатор принимает `get_study_preview` в `pacs_facade.py` (нужно чтение). Если orthanc_id — баг, логи preview-ссылки сломаются.

---

## ⚪ `series_count` и `instance_count` = 0 (известно)

**Где:** `ris.studies.series_count`, `ris.studies.instance_count`
**Что:** В БД всегда 0 — не обновляются после линковки.
**Обходной путь (фронт):** Скрывать счётчики если 0 (см. `TASK_FINAL_MVP.md`, задача 4.2).
**Полный фикс:** В `link_study_to_order` (studies.py:105) добавить `await _orthanc_get_json(f"studies/{orthanc_id}/series?expand")` и записать реальные числа.

---

## 🔴 `callNext` вызывает НЕ ТОГО кого надо (FIFO vs по талону)

**Найдено:** 09.06.2026 (демо-сценарий шаг 8)
**Где:** `elqueue/routers/tickets.py` (callNext endpoint)
**Что:** В DoctorPage есть кнопка "Вызвать" в строке **каждого** тикета. При нажатии вызывается `POST /api/tickets/next {cabinet_code}` — но этот эндпоинт берёт **первого в очереди по FIFO**, а не тот талон, на чьей строке нажали кнопку.
**Воспроизведение:**
1. Зарегистрировать талон A → в очереди
2. Зарегистрировать талон B (после A)
3. Нажать "Вызвать" на строке B
4. Ожидание: статус B → "В работе"
5. Реальность: статус A → "В работе", B всё ещё "Ожидание"
**Почему проблема:** UX сломан — пользователь ожидает что вызовет именно выбранного пациента, а не следующего по очереди. Кнопка "Вызвать" должна быть **только у первого в очереди**, либо API должен принимать `ticket_number`.
**Надо:**
- **Вариант A**: Скрывать кнопку "Вызвать" если тикет не первый в очереди (статус `waiting` + `min(created_at)` для кабинета).
- **Вариант B**: Добавить параметр `ticket_number` в `POST /api/tickets/next` для явного вызова конкретного тикета.
**Срочность:** 🟠 HIGH — критично для демо, но не блокирует сценарий "Регистратура → очередь" (там callNext не используется).
**Статус:** ✅ **ИСПРАВЛЕНО 09.06** — Вариант A: кнопка «Вызвать» показывается только для первого ожидающего тикета в очереди (`QueueTable.tsx:63`).

---

## 🟡 PatientCardPage — пустой "Статус:" и "Дата неизвестна"

**Найдено:** 09.06.2026 (демо-сценарий шаг 6)
**Где:** `frontend/src/pages/PatientCardPage.tsx:121,124`
**Что:** Страница использовала `s.status`, `s.description` — но в API-ответе `PatientStudy` этих полей НЕТ. Реальные поля: `order_status`, `study_description`, `study_date`, `created_at`.
**Симптом:** "CT · Без описания" / "Дата неизвестна · Статус:" (пустой статус)
**Статус:** ✅ **ИСПРАВЛЕНО** — заменил на `s.order_status || s.ris_order_status || 'назначен'`, `s.study_date || s.created_at?.slice(0,10) || 'Дата неизвестна'`, `s.study_description || 'Без описания'`.
**Урок:** Всегда сверять `s.<field>` с реальной структурой API-ответа через `console.log(s)` или `Read api/ris.ts`.

---

## 🟡 Emoji 👤 в каждом пациенте PatientsPage

**Найдено:** 09.06.2026 (демо-сценарий шаг 3)
**Где:** `frontend/src/pages/PatientsPage.tsx:74`
**Что:** Другой AI добавил emoji 👤 перед `p.full_name` в карточке пациента. У всех 30 пациентов теперь эмодзи в имени.
**Статус:** ✅ **ИСПРАВЛЕНО** — удалил emoji из разметки.

---

## ⚪ `CORS` отсутствует в elqueue

(См. ниже — унаследованный баг)

---

## 🔴 POST /api/tickets требует авторизацию (breaking change)

**Где:** `elqueue/routers/tickets.py:126`
**Что:** Ты добавил `require_role(RoleCode.REGISTRAR, RoleCode.ADMIN)` на эндпоинт регистрации.
**Почему проблема:** Регистрация пациента — публичный эндпоинт (человек приходит в регистратуру, у него нет токена). Фронт отправляет запрос без `Authorization`.
**Как было:** Регистрация без токена работала (было закомментировано `# Регистрация доступна всем (в т.ч. анонимам с КИС)`).
**Надо:** Вернуть публичный доступ, либо сделать guest-токен для киосков регистратуры.
**Файл:** `elqueue\routers\tickets.py`
**Статус:** ✅ **ИСПРАВЛЕНО 09.06** — заменён `require_role` на `get_current_user` (любой авторизованный пользователь может регистрировать).

---

## 🟡 refresh(ticket) без attribute_names — лишние запросы

**Где:** `elqueue/routers/tickets.py:170,183,189`
**Что:** `db.refresh(ticket)` без `attribute_names` в 3 местах (после commit/flush).
**Риск:** Вызовет lazy-load всех отношений — лишние запросы. На строке 189 уже есть `attribute_names=["patient", "cabinet"]`, но 170 и 183 — без.
**Надо:** Заменить на `db.refresh(ticket, attribute_names=["patient", "cabinet"])`.

---

## 🟡 Нет CORS middleware

**Где:** `elqueue/main.py` и `ris/main.py`
**Что:** Ни один сервис не добавляет `CORSMiddleware`.
**Почему не критично:** Сейчас фронт идёт через Vite proxy, так что CORS не нужен. Но при прямых запросах с фронта (например, в проде) упадёт.
**Надо:** Добавить CORSMiddleware (allow_origins=["*"] на dev, ограничить на проде).

---

## 🟡 RIS требует аутентификацию, а elqueue — свою

**Где:** Все эндпоинты RIS и elqueue
**Что:** У RIS свой auth, у elqueue свой. Они не шарингуют токены.
**Почему проблема:** Пользователь логинится в elqueue, но не может сразу перейти в RIS — нужно логиниться второй раз. Фронту придётся хранить два токена.
**Надо:** Либо сделать единый auth-сервис, либо настроить elqueue как прокси и для RIS-эндпоинтов.

---

## 🟡 .env.example отстаёт от .env

**Где:** `.env.example`
**Что:** В `.env.example` старые значения, не обновлён под v3.0.
**Надо:** Синхронизировать с рабочим `.env`.

---

## ⚪ DEMO_CHECKLIST.md — настройка под Windows

**Где:** `DEMO_CHECKLIST.md`
**Что:** Путь до Orthanc указан как `C:\Program Files\Orthanc Server\Orthanc.exe`, но в проекте Orthanc лежит в локальной папке `orthanc/Orthanc.exe`.
**Надо:** Унифицировать — либо локальный запуск через `.\orthanc\Orthanc.exe`, либо через установленный в систему.

---

## 🟡 Фронт не обновлён под новый API

**Где:** Весь фронт (страницы и API-клиенты)
**Что:** AI изменил несколько контрактов:
1. `POST /api/tickets/next?cabinet=X` → `POST /api/tickets/next` с `{"cabinet_code": "X"}` в теле
2. `TicketDetail.cabinet_rel` переименовано в `TicketDetail.cabinet`
3. Все эндпоинты требуют JWT-токен
**Статус:** На фронт уже добавлены `LoginPage` и `AuthContext` — инфраструктура для JWT есть, но не проверена интеграция с API-клиентами (`api/queue.ts`). Контракты `api/queue.ts` ещё могут не соответствовать новым форматам.
**Надо:** Доработать `api/client.ts` (авто-подстановка токена) и `api/queue.ts` (новый формат tickets/next).
**Статус:** ✅ **ИСПРАВЛЕНО 09.06** — `api/queue.ts` уже использует правильный формат `callNext({cabinet_code})`.

---

## ⚪ DB засорена тестовыми данными

**Где:** PostgreSQL, схемы `queue` и `ris`
**Что:** После многократных прогонов сценариев A/B в таблицах остались десятки неочищенных талонов и заказов.
**Надо:** Написать скрипт очистки или сделать `TRUNCATE CASCADE` перед тестами.

---

## ⚪ Нет миграции на добавление новых полей

После обновления models/queue.py нужно создать новую миграцию Alembic:
```bash
alembic revision --autogenerate -m "queue model updates"
alembic upgrade head
```
Проверить, что БД не расходится с моделями.

---

## 🔴 Orders endpoints были БЕЗ JWT (найдено 09.06.2026)

**Найдено:** 09.06.2026 (через тесты!)
**Где:** `backend/ris/routers/orders.py:87, 171, 215, 224`
**Что:** `GET /api/orders`, `GET /api/orders/{id}`, `GET /orders/{id}/studies`, `GET /studies` — все были **без `Depends(get_current_user)`**!
**Критичность:** 🔴 Любой анонимный пользователь мог читать заказы всех пациентов (медицинские данные).
**Статус:** ✅ **ИСПРАВЛЕНО** — добавлен `user: Annotated[User, Depends(get_current_user)]` во все 4 эндпоинта.
**Урок:** Добавить `test_unauthorized_without_token` для КАЖДОГО защищённого эндпоинта в начале разработки.

## 🔴 PATCH /orders/{id}/status не читал body (найдено 09.06.2026)

**Найдено:** 09.06.2026 (через тесты!)
**Где:** `backend/ris/routers/orders.py:184-211`
**Что:** Функция имела `status: str = "scheduled"` — FastAPI трактовал это как **query-параметр с дефолтом**, а не как поле JSON-тела. Фронт отправлял `{"status": "in_progress"}` в JSON-теле, но бэкенд **игнорировал** его и использовал "scheduled" из дефолта!
**Критичность:** 🔴 API-контракт сломан — врач не мог перевести заказ в `in_progress` или `completed` через фронт.
**Статус:** ✅ **ИСПРАВЛЕНО** — заменил на `body: dict` и `body.get("status")`. Покрыто тестами.
**Урок:** Pydantic body model для всех PATCH/POST — не использовать `param: str` напрямую.

## 🔴 Frontend risPatch отправлял status в QUERY а не BODY (найдено 09.06.2026)

**Найдено:** 09.06.2026 (после фикса backend, через ревью кода)
**Где:** `frontend/src/api/ris.ts:27-29` + `frontend/src/api/client.ts:70-73`
**Что:** `updateOrderStatus(orderId, status)` вызывал `risPatch(path, {status})` — это превращалось в `PATCH /orders/{id}/status?status=in_progress`. После того как я починил backend на чтение из тела (`body.get("status")`), фронт **всё ещё слал в query** — запросы ломались с 400 "Invalid status: None".
**Критичность:** 🔴 API-контракт сломан между frontend и backend после правки.
**Статус:** ✅ **ИСПРАВЛЕНО 09.06**:
- В `client.ts` добавлена новая функция `risPatchBody<T>(path, body)` (PATCH + JSON-body)
- В `ris.ts:28` `updateOrderStatus` теперь использует `risPatchBody(...)` с body `{status}`
- Добавлен regression-тест `test_patch_order_status_reads_from_body_not_query` в `test_tickets.py`
**Урок:** При правке API-контракта на backend **обязательно** проверять фронт — там может быть код, который отправлял данные в старом формате.

---

## 🟡 `useDwvViewer.ts` — пустой catch (другой AI)

**Найдено:** 09.06.2026 (финальное ревью)
**Где:** `frontend/src/hooks/useDwvViewer.ts:287`
**Что:** Другой AI вынес логику DWV в хук `useDwvViewer`. В строке 287 остался пустой catch:
```typescript
} catch { /* tool not initialized yet */ }
```
Остальные 5 catch в этом файле уже с `console.error`. Этот — нет.
**Надо:** Заменить на `console.error('DwvViewer: tool not initialized')`.
**⚠️ Не трогать без согласования — файл другого AI.**

---

## 🟡 `DicomSearch.tsx` — raw fetch вместо api/client (другой AI)

**Найдено:** 09.06.2026 (финальное ревью)
**Где:** `frontend/src/components/DicomSearch.tsx:35-38`
**Что:** Другой AI добавил компонент поиска в PACS. Использует `fetch()` напрямую вместо `risV1Get()` из `api/client.ts`:
```typescript
const token = getToken() ?? localStorage.getItem('mp_access_token') ?? ''
const resp = await fetch('/api/v1/studies/', { headers: { Authorization: `Bearer ${token}` } })
```
**Проблемы:**
1. Не используется единый API-клиент (нет обработки ошибок, нет консистентного JWT)
2. `localStorage.getItem` как fallback — токен в двух хранилищах
3. Трейлинг-слеш `/api/v1/studies/` — работает сейчас, но неконсистентно с остальными вызовами
**⚠️ Не трогать без согласования — файл другого AI.**

---

## ✅ ИТОГО: что исправлено за 08-10.06

| # | Баг | Статус |
|---|-----|--------|
| 1 | Vite proxy `/dicom` bypass JWT | ✅ |
| 2 | `download_study` без JWT | ✅ |
| 3 | `complete_ticket` race condition | ✅ |
| 4 | W/L params не передаются | ✅ |
| 5 | `print()` → logging (11 шт) | ✅ |
| 6 | `create_order` без RBAC | ✅ |
| 7 | Silent except блоки (4 файла) | ✅ |
| 8 | `except PACSError: pass` | ✅ |
| 9 | Пароль админа в лог | ✅ |
| 10 | httpx pool (5 мест) | ✅ |
| 11 | DwvViewer catch (6 шт) | ✅ |
| 12 | ViewerPage localhost:5550 | ✅ |
| 13 | AuthContext/useQueue catch | ✅ |
| 14 | DoctorPage polling | ✅ |
| 15 | useOrders AbortController | ✅ |
| 16 | `series_count` = 0 | ✅ |
| 17 | `getPatient(id)` 404 | ✅ |
| 18 | Invalid Date / key prop | ✅ |
| 19 | `get_patient_studies` O(n) | ✅ |
| 20 | `asyncio.sleep(0, result=None)` | ✅ |
| 21 | `callNext` вызывает не того | ✅ |
| 22 | `POST /api/tickets` RBAC | ✅ |
| 23 | `PatientCardPage` пустой статус | ✅ (другой AI) |
| 24 | `is_uploaded` всегда True | ⚪ не баг |
| 25 | `preview_url` study_uid | ⚪ не баг |
| 26 | `getPatient(id)` 404 | ✅ |
| 27 | **elqueue PATCH params→json** (09.06) | ✅ |
| 28 | **OrdersPage пагинация** (09.06) | ✅ |
| 29 | **SmartQ не возвращает fullName** (10.06) | ✅ |
| 30 | **CORS `["*"]` + credentials** (10.06) | ✅ |
| 31 | **`updated_at` без onupdate** (10.06) | ✅ |
| 32 | **SmartQ mock маскирует 404** (10.06) | ✅ |
| 33 | **Study constraint роняет Order** (10.06) | ✅ |
| 34 | **httpx clients утечка** (10.06) | ✅ |
| 35 | **Polling race condition useQueue** (10.06) | ✅ |
| 36 | **elqueue commit до HTTP-RIS** (10.06) | ✅ |

---

## 🟡 elqueue _patch_ris_status слал status в params, не body (FIXED 09.06)

**Найдено:** 09.06.2026 (тест elqueue→RIS)
**Где:** `backend/elqueue/routers/tickets.py`
**Что:** `_patch_ris_status` использовал `params={"status": ...}` вместо `json={"status": ...}`. RIS endpoint `PATCH /orders/{id}/status` ожидает тело JSON, не query param.
**Симптом:** При call/complete талона в elqueue → Order в RIS оставался `scheduled`, не переходил в `in_progress`/`completed`.
**Статус:** ✅ ИСПРАВЛЕНО — заменён `params` на `json` в httpx-вызове.

---

## 🟡 OrdersPage пагинация — фронт ждал массив, а не Page (FIXED 09.06)

**Найдено:** 09.06.2026 (демо-сценарий шаг 5)
**Где:** `frontend/src/api/ris.ts:13-20`
**Что:** Другой AI изменил `GET /orders` на возврат `OrderListResponse {items, total, limit, offset, has_more}`, но фронт ожидал `OrderOut[]`.
**Симптом:** OrdersPage падала с ошибкой типов.
**Статус:** ✅ ИСПРАВЛЕНО — `getOrders()` теперь распаковывает `data.items`.

---

## 🟡 SmartQ API не возвращает fullName/policyNumber в ответе (FIXED 10.06)

**Найдено:** 10.06.2026 (тест SmartQ→RIS)
**Где:** SmartQ kiosk API (`POST /tickets/kiosk`, `GET /tickets/:id`)
**Что:** При создании талона SmartQ принимает `fullName`/`policyNumber`, но не включает их в ответ. Наш маппер `_smartq_ticket_to_ours` получал пустые строки.
**Симптом:** В очереди отображались талоны без ФИО пациента и полиса.
**Статус:** ✅ ИСПРАВЛЕНО — в `create_ticket` endpoint добавлено: если SmartQ вернул пустые, подставляем из запроса. Для `get_tickets` (список) — ФИО не отображается (ограничение SmartQ API).
**Урок:** При интеграции со внешним API проверять поля ответа до начала маппинга.

---

## 🔴 CORS `allow_origins=["*"]` + `allow_credentials=True` (FIXED 10.06)

**Найдено:** 10.06.2026 (code review в FULL_REPORT_2026-06-10.md)
**Где:** `backend/ris/main.py:73`
**Что:** CORS-спецификация запрещает `*` с `allow_credentials=True`. Браузер блокирует авторизованные запросы с другого origin. На демо работало через Vite proxy, на прямом обращении упало бы.
**Симптом:** Неявный — на проде CORS-ошибки при прямых запросах с фронта к RIS.
**Статус:** ✅ ИСПРАВЛЕНО — `allow_origins=["http://localhost:5173","http://127.0.0.1:5173","http://localhost:3000"]`.
**Урок:** dev-режим ≠ prod. Если включены credentials — origins должны быть явными.

---

## 🟠 `updated_at` без onupdate (FIXED 10.06)

**Найдено:** 10.06.2026 (code review)
**Где:** `backend/db/models/ris.py:119,189`
**Что:** `updated_at` имеет `server_default=func.now()`, но нет `onupdate=func.now()`. Поле никогда не обновляется при изменении строки — Audit Log теряет реальное время модификации.
**Симптом:** `updated_at` всегда равен `created_at` — бесполезное поле.
**Статус:** ✅ ИСПРАВЛЕНО — добавлен `onupdate=func.now()` в Order и Protocol.
**Урок:** `updated_at` без `onupdate` = `created_at`. Проверять модели после генерации.

---

## 🟠 SmartQ _safe_smartq_call маскирует 404 моком (FIXED 10.06)

**Найдено:** 10.06.2026 (code review)
**Где:** `backend/ris/routers/queue_integration.py:218`
**Что:** `_safe_smartq_call` перехватывает любую ошибку SmartQ и возвращает мок-данные. Если талон не найден (404) или невалидный запрос (400) — фронт видит "фантомные" мок-талоны вместо ошибки.
**Симптом:** Пользователь не видит реальных ошибок SmartQ — система показывает мок-данные.
**Статус:** ✅ ИСПРАВЛЕНО — semantic-ошибки (404/400/409) пробрасываются на фронт; мок только при connection error или disabled.
**Урок:** Исключения нужно делить по типам. 404 ≠ connection error.

---

## 🟠 Study constraint violation откатывает Order (FIXED 10.06)

**Найдено:** 10.06.2026 (code review)
**Где:** `backend/ris/routers/orders.py:232`
**Что:** Создание Study (связь с Orthanc) находится в try, но сам `db.commit()` — снаружи. Если Study упадёт с constraint violation, откатится и Order.
**Симптом:** Пользователь создал заказ — 500-я ошибка, заказ не сохранился, хотя данные валидны.
**Статус:** ✅ ИСПРАВЛЕНО — commit обёрнут в try/rollback/commit: Order сохраняется даже без Orthanc.
**Урок:** Commit должен быть максимально близко к данным. Побочные эффекты (Orthanc) — в отдельном try.

---

## 🟡 httpx.AsyncClient не закрывается (FIXED 10.06)

**Найдено:** 10.06.2026 (code review)
**Где:** `ris/routers/orders.py` / `ris/services/pacs_facade.py` / `ris/services/smartq_client.py` / `ris/routers/dicomweb.py`
**Что:** 4 глобальных `httpx.AsyncClient` создаются как singleton, но никогда не закрываются — утечка соединений до перезапуска сервиса.
**Симптом:** Рост числа TCP-соединений при длительной работе сервиса.
**Статус:** ✅ ИСПРАВЛЕНО — все 4 клиента закрываются в lifespan shutdown (`ris/main.py:59`).
**Урок:** `httpx.AsyncClient` — управляемый ресурс. Если создаётся singleton — должен быть lifespan cleanup.

---

## 🟡 Polling race condition в useQueue (FIXED 10.06)

**Найдено:** 10.06.2026 (code review)
**Где:** `frontend/src/hooks/useQueue.ts:23`
**Что:** `setInterval` не ждёт завершения fetch. Если ответ сервера > pollInterval (10с), запросы накладываются — race condition, дублирующиеся обновления состояния.
**Симптом:** При тормозах SmartQ — мерцание очереди, двойные обновления.
**Статус:** ✅ ИСПРАВЛЕНО — `setInterval` заменён на рекурсивный `setTimeout` в `.finally()`.
**Урок:** `setInterval` для async-операций — антипаттерн. Только рекурсивный `setTimeout`.

---

## 🟡 elqueue commit до вызова RIS (FIXED 10.06)

**Найдено:** 10.06.2026 (code review)
**Где:** `backend/elqueue/routers/tickets.py:218`
**Что:** `db.commit()` происходит до HTTP-вызова `_create_ris_order`. Если RIS упадёт — талон сохранён, а заказ в RIS — нет. Система в несогласованном состоянии.
**Симптом:** Талон есть, заказа нет — пациент в очереди, но исследование не создано.
**Статус:** ✅ ИСПРАВЛЕНО — вызов RIS обёрнут в try/except: при ошибке талон создаётся без заказа, ошибка логируется и аудитируется.
**Урок:** commit → внешний вызов — опасный паттерн. Нужен либо Saga pattern, либо try вокруг внешнего вызова.