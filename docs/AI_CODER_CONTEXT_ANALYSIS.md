# Анализ AI_CODER_FULL_CONTEXT.md относительно текущего проекта

Было 2 версии файла:
- **v1** (`AI_CODER_FULL_CONTEXT.md` в корне) — промт/спецификация «идеального» RIS-PACS, **НЕ** отражала реальность
- **v2** (текущая `docs/AI_CODER_FULL_CONTEXT.md`) — **актуальная документация**, отражает реальное состояние на 08.06.2026

v2 заменила v1. Она точна и может использоваться как основной референс.

## Расхождения v1 с реальностью (историческая справка)

| Аспект | В документе | В проекте (факт) |
|--------|-------------|-------------------|
| **Frontend framework** | React 18, НЕТ Next.js | **Гибрид**: Next.js 15 (root) + React 19 + Vite 8 (`frontend/`) |
| **Python** | 3.10+ | 3.14.3 |
| **PostgreSQL** | 17 | **16** |
| **Orthanc** | 1.12+ | **26.6.0** |
| **Docker** | Да, обязателен | **Нет** (нативный запуск) |
| **Структура frontend** | `components/ui/`, `components/appointment/`, `components/viewer/DicomViewer.tsx` | `components/DwvViewer.tsx`, `pages/StudioPage.tsx` — другая структура |
| **Pages** | RegistrationPage, DoctorPage, OrdersPage, StudiesPage | StudioPage, ViewerPage — другие названия |
| **Серии/инстансы** | Не описаны | Есть эндпоинты `/api/v1/series/{id}/instances`, thumbnail, кэш |
| **Perf-оптимизация** | Не описана | Сделана (3s → 46ms, in-memory кэш, `?expand`) |
| **DICOMweb прокси** | `/dicom-files/{id}/file` (без JWT) | `/dicom` → Orthanc `/dicom-web` (только мультимедиа) + `/api/v1/instances/{id}/dicom` (с JWT) |
| **CORS** | ❌ «Не настроен» | ✅ Уже `allow_origins=["*"]` |
| **Статус проекта** | «Нужно создать» страницы | Большинство уже существует |

## Что из документа применимо

- **Patient flow** (пациент → заказ → снимок) — верно описывает бизнес-логику
- **Технологический стек backend** (FastAPI, PostgreSQL, SQLAlchemy, Alembic) — совпадает
- **JWT аутентификация** — совпадает (Bearer token)
- **Архитектура** (браузер → RIS → Orthanc) — верна
- **Клиентские библиотеки** (DWV, Tailwind, lucide-react) — совпадают
- **Шаблон** `loading / error / data` — общепринятый, использовать можно
- **Цветовая схема** (teal-600, gray-50) — можно применить

## Что из документа НЕ РЕЛЕВАНТНО

- React 18 → у нас React 19
- Запрет Next.js → у нас Next.js 15 в корне
- Docker → отсутствует
- Номера портов компонентов — надо сверять с реальными
- CORS «не настроен» — уже настроен
- Known bugs — большинство уже исправлены
- Список референсных проектов — некоторые устарели
- `components/viewer/DicomViewer.tsx` — у нас `DwvViewer.tsx`

## Рекомендации

1. **Не использовать файл как актуальную документацию** — он содержит spec, а не as-built
2. **Сверять названия компонентов/страниц** перед созданием — многие уже существуют под другими именами
3. **Паттерны данных** (loading/error/data, debounce, cleanup) — корректны, можно использовать
4. **Business logic flow** (связь пациент→заказ→снимок) — верен, опираться на него
