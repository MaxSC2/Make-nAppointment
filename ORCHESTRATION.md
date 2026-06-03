# ORCHESTRATION.md — Доска координации

> **Назначение:** Координация Lead AI с worker'ами и бэкенд-командой.
> Обновляется Lead AI после каждого цикла синхронизации.

---

## Текущий спринт: MVP «Пациент → Очередь → Кабинет → Исследование → Протокол»

### Прогресс компонентов

| Компонент | Статус | Ответственный | Последнее изменение |
|---|---|---|---|
| RegistrationPage | ✅ Работает | Фронт (я) | 04.06 |
| QueuePage (DoctorPage) | ✅ Работает | Фронт (я) | 04.06 |
| OrdersPage | ✅ Работает | Фронт (я) | 04.06 |
| StudiesPage | ✅ Создана | Фронт (я) | 04.06 |
| ViewerPage | ✅ Создана | Фронт (я) | 04.06 |
| AuthContext | ✅ Создан | Фронт (я) | 04.06 |
| API-клиенты (orders, queue) | ✅ Готовы | Фронт (я) | 04.06 |
| **Проблема: фронт не шлёт JWT** | 🔴 Открыта | Нужно решение | 05.06 |
| Бэкенд: elqueue сервис (8005) | ✅ Работает | AI-кодер | 05.06 |
| Бэкенд: RIS сервис (8000) | ✅ Работает | AI-кодер | 05.06 |
| Бэкенд: PACS-фасад (REST v1) | ✅ Новое | AI-кодер | 06.06 |
| Бэкенд: error_handlers | ✅ Новое | AI-кодер | 06.06 |
| Бэкенд: RBAC | ✅ Добавлен | AI-кодер | 05.06 |
| Документация: RIS_vs_PACS.md | ✅ Добавлена | AI-кодер | 06.06 |
| Сценарий A (регистрация → приём) | ✅ Пройден | Я | 04.06 |
| Сценарий B (множество кабинетов) | ✅ Пройден | Я | 05.06 |
| Сценарий C (отказоустойчивость) | ⏳ Не начат | — | — |

### Бэкенд-контракты (pacs-ris-queue)

```
elqueue (8005):
  POST   /api/auth/login                 → { access_token, token_type }
  POST   /api/auth/register              → { id, username, role }  (🔴 требует REGISTRAR/ADMIN)
  GET    /api/cabinets                   → [{ id, code, name }]
  GET    /api/tickets                    → [{ id, patient…, cabinet, status, created_at }]
  POST   /api/tickets                    → Ticket (🔴 требует токен)
  POST   /api/tickets/next              → { ticket, queue_length }
          Body: { cabinet_code: str }    (🔴 теперь тело, не query)
  POST   /api/doctors/create_order       → Order

ris (8000):
  GET    /api/orders                     → [Order]
  GET    /api/orders/{id}                → Order
  POST   /api/orders                     → Order
  PATCH  /api/orders/{id}/status         → Order
  GET    /api/modalities                 → [Modality]
  GET    /api/orders/{id}/protocol       → Protocol
  PUT    /api/orders/{id}/protocol       → Protocol
  POST   /api/orders/{id}/protocol/sign  → Protocol
  GET    /api/v1/studies                 → [StudyWithOrder]  ← PACS-фасад (новое)
  GET    /api/v1/studies/{uid}           → StudyDetails
  GET    /api/v1/studies/{uid}/preview   → PNG
  GET    /api/v1/instances/{id}/preview  → PNG
  GET    /api/v1/instances/{id}/dicom-tags → DicomTags
  GET    /api/v1/patients/{id}/studies   → [StudyWithOrder]
  GET    /api/v1/orders/{id}/dicom       → StudyWithOrder
```

---

## Активные задачи

### 🔴 Критично: фронт не авторизован
- Все эндпоинты elqueue защищены RBAC
- Фронт не хранит/не шлёт JWT-токен
- **Варианты решения:** guest-токен на бэке / откатить require_role на POST /tickets / добавить логин на фронт
- **Статус:** ждём решение бэкенд-команды

### Синхронизация
- ✅ 06.06: синхронизированы 9 файлов (pacs-ris-queue → MedPlatform/backend)
- Включая: PACS-фасад, error_handlers, studies router, CSS design system

---

## Ключевые файлы
- **BUGS.md** — 8 багов (2 🔴)
- **CONTEXT.md** — база знаний для worker'ов
- **TRACKER.md** — прогресс по задачам
- **PRACTICE_LOG.md** — дневник практики
- **DEMO_CHECKLIST.md** — чеклист демо
- **TZ.md** — ТЗ v3.0
