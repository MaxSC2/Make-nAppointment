# Code Review: PACS-RIS-Queue (08.06.2026)

> Полное ревью кодовой базы: backend (FastAPI) + frontend (Vite 8 + React 19) + корень (Next.js 15)
> Методология: инспекция всех файлов в `backend/`, `frontend/src/`, ключевых файлов корня

---

## Условные обозначения

| Метка | Значение |
|-------|----------|
| 🔴 CRITICAL | Баг в рантайме, потеря данных, безопасность |
| 🟠 HIGH | Серьёзная проблема, требует исправления |
| 🟡 MEDIUM | Нарушение best practices, потенциальный баг |
| 🔵 LOW | Косметика, рефакторинг, улучшайзинг |

---

## 🔴 CRITICAL

### 1. Vite proxy пропускает к Orthanc без JWT
**Файл:** `frontend/vite.config.ts:25-29`
**Проблема:** Прокси `/dicom` → `localhost:8042/dicom-web` позволяет фронтенду ходить напрямую в Orthanc DICOMweb, минуя JWT-проверку RIS. DWV может работать напрямую с Orthanc.
**Фикс:** Убрать прокси `/dicom`, перенаправить DWV через PACS-фасад `/api/v1/...`

### 2. download_study — анонимный доступ
**Файл:** `ris/routers/orders.py:311-334`
**Проблема:** Эндпоинт `GET /api/studies/download/{study_uid}` не имеет `Depends(get_current_user)`. Любой может скачать ZIP с DICOM-снимками.
**Фикс:** Добавить `current_user: Annotated[User, Depends(get_current_user)]` в параметры.

### 3. complete_ticket — race condition
**Файл:** `elqueue/routers/tickets.py:245-285`
**Проблема:** `call_next` использует `with_for_update(skip_locked=True)`, а `complete_ticket` — нет. Два параллельных запроса могут завершить один талон дважды → двойной аудит, двойной PATCH в RIS.
**Фикс:** Добавить `with_for_update()`.

---

## 🟠 HIGH

### 4. Нет logging — 73 print() по всему бэкенду
**Файлы:** `ris/main.py`, `ris/routers/orders.py`, `elqueue/main.py`, `elqueue/routers/tickets.py`, `db/init_db.py`, `load-test-data.py`, `generate-test-images.py`
**Проблема:** `print()` вместо `logging.info/error/warning`. Нет уровней, ротации, формата, невозможно фильтровать.
**Фикс:** Заменить на `logging.getLogger(__name__)`.

### 5. create_order без RBAC
**Файл:** `ris/routers/orders.py:92`
**Проблема:** `Depends(get_current_user)` — достаточно быть залогиненным. Даже роль `viewer` может создать заказ на исследование.
**Фикс:** Добавить `Depends(require_role(RoleCode.DOCTOR, RoleCode.REGISTRAR, RoleCode.ADMIN))`.

### 6. Silent failure в audit и Orthanc-запросах
**Файлы:**
- `ris/routers/orders.py:147` — `except Exception: print(...)` — ошибка Orthanc глотается
- `ris/routers/orders.py:443-446` — `except Exception: await db.rollback()` — аудит молча откатывается
- `elqueue/routers/tickets.py:355-358` — то же самое
- `ris/services/pacs_facade.py:550` — `except PACSError: pass`
**Проблема:** Ошибки проглатываются, теряются данные аудита, статусы могут рассинхронизироваться.
**Фикс:** Логировать ошибки, не использовать голый `except: pass`.

### 7. W/L params не пробрасываются в Orthanc
**Файл:** `ris/services/pacs_facade.py:453-456`
**Проблема:** Viewer шлёт `?W=400&L=40`, но `get_instance_preview()` не принимает параметры и не передаёт их в Orthanc. Превью всегда с дефолтным окном.
**Фикс:** Добавить query params `W` и `L` в прокси-запрос к Orthanc.

### 8. Пароль админа в лог при старте
**Файл:** `db/init_db.py:131`
**Проблема:** `print(f"...{settings.admin_password}")` выводит пароль в консоль. Кто угодно с доступом к логам получает админские credentials.
**Фикс:** Убрать пароль из print.

### 9. SESSION.md отстаёт от реальности
**Файл:** `C:\Projects\ARCHIVE\MedPlatform\SESSION.md` (в корне бэка)
**Проблема:** SESSION.md помечает `/api/v1/instances/{id}/dicom` и DICOMweb как "critical unfixed". Фактически — обе закрыты JWT. W/L params (critical) — всё ещё не починено. N+1 (medium) — починен.
**Фикс:** Обновить статусы в SESSION.md.

---

## 🟡 MEDIUM

### 10. Новый httpx.AsyncClient на каждый запрос
**Файлы:** `ris/routers/dicomweb.py:39`, `ris/routers/orders.py:365,410`, `elqueue/routers/tickets.py:301,329`
**Проблема:** Создаётся новый HTTP-клиент per request, нет connection pooling. В `pacs_facade.py:55-66` есть правильный singleton `_get_orthanc_client()`, но в роутерах и `_send_metadata_to_orthanc` — нет.
**Фикс:** Использовать единый `httpx.AsyncClient` (как в pacs_facade).

### 11. Нет auth на справочниках
**Файлы:** `ris/routers/orders.py:62`, `elqueue/routers/tickets.py:48`
**Проблема:** `GET /api/modalities` и `GET /api/cabinets` — без какой-либо аутентификации (даже `get_current_user`). Low risk (read-only), но неконсистентно с остальными эндпоинтами.
**Фикс:** Добавить `Depends(get_current_user)`.

### 12. Токены в двух хранилищах (frontend)
**Файл:** `frontend/src/api/client.ts:5-13`, `frontend/src/components/DwvViewer.tsx:155`
**Проблема:** In-memory `authToken` + fallback на `localStorage.getItem('mp_access_token')`. Два источника правды — после logout токен может остаться в localStorage и продолжать использоваться.
**Фикс:** Единый источник — in-memory, localStorage только для сохранения между вкладками.

### 13. Пустые catch блоки в DwvViewer
**Файл:** `frontend/src/components/DwvViewer.tsx:105,108,135,224,228,236`
**Проблема:** Минимум 5 пустых `catch { /* ignore */ }`. Подавляют все исключения — если DWV выбросит ошибку, пользователь её не увидит.
**Фикс:** Логировать в `console.error` хотя бы в development.

### 14. Неиспользуемые импорты в pacs_facade
**Файл:** `ris/services/pacs_facade.py:22-24`
**Проблема:** `import asyncio, time, uuid` — не используются напрямую (asyncio используется, но через `asyncio.Semaphore`, `asyncio.gather`).
**Фикс:** Убрать неиспользуемые импорты.

### 15. UserOut импортируется без использования
**Файл:** `db/dependencies.py:24`
**Проблема:** `from db.schemas.auth import UserOut` — импортирован, но не используется в файле.
**Фикс:** Убрать импорт.

### 16. Нет тестов
**Файлы:** весь проект
**Проблема:** Нет ни unit, ни integration тестов. Ни одного файла `test_*.py` или `*.test.tsx`.

---

## 🔵 LOW

### 17. CORS allow_origins=["*"]
**Файл:** `ris/main.py`, `elqueue/main.py`
**Проблема:** Открытый CORS для разработки. Понятно почему, но в SECURITY_AUDIT уже есть как пункт.

### 18. Хардкод localhost в HTML-шаблонах
**Файл:** `ris/templates/viewer.html`
**Проблема:** Ссылки на `http://localhost:8042` и `http://localhost:8000` в HTML-шаблоне.

### 19. Отсутствие dir="ltr" и мета-тегов в корневом layout
**Файл:** `app/layout.tsx` (корень Next.js)
**Проблема:** Нет `dir="ltr"`, нет полных viewport/theme-color мета-тегов.

### 20. page.tsx.bak и page.tsx.newbak
**Файл:** `app/page.tsx.bak`, `app/page.tsx.newbak`
**Проблема:** Закоммиченные backup-файлы в корневой папке приложения. Нужно удалить.

### 21. ViewerPage открывает NestJS-вьювер на localhost:5550
**Файл:** `frontend/src/pages/ViewerPage.tsx:12`
**Проблема:** Хардкод `http://localhost:5550/viewer.html`. Этот порт (NestJS) не запущен и, возможно, не нужен.

### 22. SESSION.md устарел (неактуальные статусы)
**Файл:** `C:\Projects\pacs-ris-queue\SESSION.md`
**Проблема:** Помечает как "критические unfixed":
- DICOMweb proxy — ✅ уже закрыт JWT (`dicomweb.py:85`)
- `/api/v1/instances/{id}/dicom` — ✅ уже закрыт JWT (`studies.py:238`)
- N+1 — ✅ уже починен (`pacs_facade.py:388-394`, parallel ?expand)
А W/L params — действительно всё ещё не починен.

### 23. useCabinets и useOrders — нет cleanup / race condition
**Файл:** `frontend/src/hooks/useQueue.ts:46`, `frontend/src/hooks/useOrders.ts:23`
**Проблема:** `useCabinets` не отменяет fetch при unmount. `useOrders` не использует AbortController и не отменяет предыдущий запрос при смене `status`.

### 24. DoctorPage — ручная загрузка вместо polling
**Файл:** `frontend/src/pages/DoctorPage.tsx`
**Проблема:** Нет polling (в отличие от `useQueue`). Врач должен нажимать «Обновить» вручную, очередь не обновляется автоматически.

---

## Итого

| Уровень | Количество |
|---------|-----------|
| 🔴 CRITICAL | 3 |
| 🟠 HIGH | 6 |
| 🟡 MEDIUM | 8 |
| 🔵 LOW | 7 |

### Топ-10, что чинить в первую очередь

| # | Ур. | Проблема | Файл |
|---|-----|----------|------|
| 1 | 🔴 | Vite proxy `/dicom` → Orthanc bypass | `vite.config.ts:25` |
| 2 | 🔴 | `download_study` без JWT | `orders.py:311` |
| 3 | 🔴 | `complete_ticket` race condition | `tickets.py:245` |
| 4 | 🟠 | 73 `print()` вместо logging | весь backend |
| 5 | 🟠 | `create_order` без RBAC | `orders.py:92` |
| 6 | 🟠 | Silent failure (audit, Orthanc) | 4 файла |
| 7 | 🟠 | W/L params не пробрасываются | `pacs_facade.py:453` |
| 8 | 🟠 | Пароль админа в лог | `init_db.py:131` |
| 9 | 🟠 | SESSION.md устарел | `SESSION.md` |
| 10 | 🟡 | httpx client per request | 4 файла |
| 11 | 🟡 | SESSION.md устарел | `SESSION.md` |
| 12 | 🟡 | useCabinets/useOrders без cleanup | `hooks/useQueue.ts:46` |
| 13 | 🔵 | DoctorPage без polling | `DoctorPage.tsx` |
| 14 | 🔵 | ViewerPage хардкод localhost:5550 | `ViewerPage.tsx:12` |

---

## Вторая волна ревью (08.06 — после исправлений)

> Полный пересмотр всей кодовой базы после фиксов первой волны.
> Найдено 17 новых замечаний (0 🔴, 2 🟠, 15 🟡).

### 🟠 HIGH

#### 15. ~~`except PACSError: pass`~~ ✅ FIXED
**Файл:** `ris/services/pacs_facade.py:568`
Добавлен `logger.warning` с сообщением об ошибке.

#### 16. ~~Пароль админа в лог~~ ✅ FIXED
**Файл:** `db/init_db.py:131`
Заменён на `***`.

### 🟡 MEDIUM

#### 17. `asyncio.sleep(0, result=None)` — нестандартный паттерн
**Файл:** `ris/services/pacs_facade.py:295`
```python
modality_tasks.append(asyncio.sleep(0, result=None))
```
Dummy-awaitable в `gather()`. Синтаксис корректен (Python 3.10+), но неочевиден.

#### 18. `get_patient_studies` загружает все исследования
**Файл:** `ris/services/pacs_facade.py:539`
```python
all_studies = await list_all_studies(db)
return [s for s in all_studies if ...]
```
Загружает ВСЕ DICOM-исследования из Orthanc + JOIN с БД, потом фильтрует одного пациента. O(n).

#### 19-23. `httpx.AsyncClient()` per request (5 мест)
| Файл | Строка | Таймаут | Контекст |
|------|--------|---------|----------|
| `orders.py` | 320 | 60 | `download_study` |
| `orders.py` | 371 | 30 | `_orthanc_forward` |
| `orders.py` | 419 | 5 | `_send_to_orthanc` |
| `tickets.py` | 305 | 5 | `_create_ris_order` |
| `tickets.py` | 335 | 3 | `_patch_ris_status` |

Все создают новый HTTP-клиент без connection pool. В `pacs_facade.py` и `dicomweb.py` уже есть singleton-клиенты.

#### 24. `AuthContext`: пустой catch на JSON.parse
**Файл:** `frontend/src/contexts/AuthContext.tsx:42`
```typescript
try { setUser(JSON.parse(u)) } catch { localStorage.removeItem(STORAGE_USER) }
```
Ошибка глотается без лога.

#### 25. `AuthContext`: fetch напрямую в обход api/client.ts
**Файл:** `frontend/src/contexts/AuthContext.tsx:47-76`
`fetch('/elqueue/api/auth/me', ...)` и `fetch('/elqueue/api/auth/refresh', ...)` — не используют `api/client.ts` request wrapper. Нет консистентного JWT-заголовка.

#### 26. `useCabinets`: пустой catch + нет AbortController
**Файл:** `frontend/src/hooks/useQueue.ts:45-50`
```typescript
queueApi.getCabinets().then(setCabinets).catch(() => {}).finally(...)
```

#### 27. `useOrders`: нет AbortController
**Файл:** `frontend/src/hooks/useOrders.ts:23`
Смена фильтра status запускает fetch без отмены предыдущего — race condition.

#### 28. `DwvViewer`: 6 пустых catch блоков
**Файл:** `frontend/src/components/DwvViewer.tsx:105,108,135,224,228,236`

#### 29. `ViewerPage`: хардкод localhost:5550
**Файл:** `frontend/src/pages/ViewerPage.tsx:12`

#### 30. `DoctorPage`: нет polling
**Файл:** `frontend/src/pages/DoctorPage.tsx:14-25`

#### 31. `config.py`: дефолтные credentials в коде
**Файл:** `db/config.py:56,72`
JWT-секрет и пароль админа захардкожены как default-значения.

### 🔵 LOW

#### 32. CORS `allow_origins=["*"]`
**Файлы:** `ris/main.py:62`, `elqueue/main.py:62`

#### 33. Нет тестов
0 unit/integration/e2e.

### Итого (обе волны)

| Волна | 🔴 | 🟠 | 🟡 | 🔵 |
|-------|----|----|----|-----|
| Первая | 3 → ✅3 | 6 → ✅4 | 8 | 7 |
| Вторая | 0 | 2 → ✅2 | 15 → ✅9 | 2 |
| **Осталось** | **0** | **0** | **6** | **2** |

**Топ-5 (осталось):**
1. 🟡 httpx pool в 5 местах → singleton
2. 🟡 AuthContext fetch напрямую → через api/client
3. 🟡 useOrders нет AbortController
4. 🟡 DoctorPage без polling
5. 🟡 Нет тестов

---

## Волна 3: ревью DICOM Viewer (09.06)

> Фокус: `useDwvViewer.ts`, `DwvViewer.tsx`, `ViewerPage.tsx`

### ✅ Что хорошо

| # | Файл | Что |
|---|------|-----|
| 1 | `useDwvViewer.ts:98` | `Draw: { options: DRAW_SHAPES }` — правильная конфигурация |
| 2 | `useDwvViewer.ts:152-156` | `requestAnimationFrame` ожидание размеров контейнера |
| 3 | `useDwvViewer.ts:120-134` | Загрузка DICOM через fetch+JWT → `loadFiles()` — надёжно |
| 4 | `DwvViewer.tsx:153-225` | Сайдбар с вкладками, сериями, инфо-панелью |
| 5 | `DwvViewer.tsx:228-237` | Статус-бар: Study UID, серия, срезов |
| 6 | `ViewerPage.tsx` | Чистый, full-screen, без Layout |

### 🟡 MEDIUM

#### 34. ~~`label: 'Cрезы'`~~ ✅ FIXED
**Файл:** `useDwvViewer.ts:7`
Исправлено на `Срезы` (кириллическая С).

#### 35. ~~`loadSeries` последовательная загрузка~~ ✅ FIXED
**Файл:** `useDwvViewer.ts:122-130`
Заменён на `Promise.all` — параллельная загрузка всех срезов.

#### 36. ~~`loadend` читает `activeTool`/`activeShape` из стейла~~ ✅ FIXED
**Файл:** `useDwvViewer.ts:192`
Добавлены `activeToolRef`, `activeShapeRef`. `loadend` читает рефы.

#### 37. ~~`useEffect` dep `[loadSeries, onError]`~~ ✅ FIXED
**Файл:** `useDwvViewer.ts:293`
`onError` заменён на `onErrorRef`. Зависимости: `[initApp]` и `[studyUid, loadSeries]`.

### 🔵 LOW

#### 38. `v.appRef.current` в render — ESLint react-hooks/refs
**Файл:** `DwvViewer.tsx:76`
```typescript
disabled={!v.appRef.current}
```
Чтение ref.current в JSX. Флаг ESLint, не влияет на работу.

#### 39. Unicode emoji `⬡` в ViewerPage
**Файл:** `ViewerPage.tsx:30`
Нестандартно для проекта, но допустимо для empty-state.

### Обновлённый итог

| Волна | 🔴 | 🟠 | 🟡 | 🔵 |
|-------|----|----|----|-----|
| Первая | 3 → ✅3 | 6 → ✅4 | 8 | 7 |
| Вторая | 0 | 2 → ✅2 | 13 → ✅10 | 2 |
| Третья (viewer) | 0 | 0 | 4 → ✅4 | 2 |
| **Осталось** | **0** | **0** | **6** | **4** |
