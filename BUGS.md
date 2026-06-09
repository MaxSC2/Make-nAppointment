# Баги и несоответствия — для AI-кодера (бэкенд)

> Статусы: 🔴 Критично | 🟡 Надо поправить | ⚪ Пожелание
> Обновлять по мере нахождения.

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
