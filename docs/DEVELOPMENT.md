# История разработки MedPlatform

## Этап 1 — Инициализация проекта

- Создан Next.js 15 проект через `create-next-app`
- Установлены зависимости: `lucide-react`, Tailwind CSS v4
- Настроена дизайн-система в `globals.css` через `@theme`
- Добавлен `.gitignore`, инициализирован Git-репозиторий
- Созданы базовые типы: `types/appointment.ts`, `types/laboratory.ts`
- Написаны мок-данные: 6 врачей, слоты, анализы, направления

## Этап 2 — Основные страницы

- **Layout**: корневой layout с Inter, хедер (десктоп + мобильный), MobileNav
- **Landing** (`/`): хедер с логотипом, hero с градиентом, статистика, карточки возможностей, CTA, футер
- **Логин/Регистрация**: формы с валидацией, установка куки, редирект
- **Дашборд**: быстрые действия, записи, результаты анализов
- **EMK** (`/emk/*`): сайдбар, карточка пациента, визиты, назначения
- **Лаборатория**: табы (анализы/направления), поиск, статусы, заглушки для скачивания
- **Запись к врачу**: список врачей, календарь, модалка бронирования, мои записи

## Этап 3 — Доработки после первого билда

### Проблемы с билдом
- Несколько ошибок компиляции (неиспользуемые импорты, пропущенные экспорты) — исправлено
- `next.config.ts` — настроен `serverExternalPackages`
- Очистка `.next` кэша при необъяснимых ошибках

### Баги
- **Notification dropdown** — отсутствовал `z-50` на десктопе (перекрывался другим контентом)
- **Ссылка «Профиль»** → было `#`, исправлено на `/emk`
- **MobileNav «Профиль»** → заменено на «Анализы» с flask-иконкой, ведёт на `/laboratory`
- **Appointment page** — `filteredDoctors` не зависел от `doctorsQuery.data` (замыкание на пустой массив)
- **Visit history search** — строка поиска не была подключена к фильтрации
- **MobileNav пропадал** — не хватало `pb-20` на страницах, добавлено

## Этап 4 — API-слой

- Создан `lib/api/types.ts` с `ApiResponse<T>`
- Создан `lib/api/index.ts` — async-функции с имитацией задержки
- Создан `lib/api/hooks.ts` — `useQuery<T>` с авто-загрузкой
- Страницы лаборатории и записи переведены на API-слой
- Добавлены скелетоны загрузки и блоки ошибок с кнопкой «Повторить»

## Этап 5 — Route guard

- Создан `middleware.ts` с проверкой `auth_token` cookie
- Защищённые роуты: `/dashboard`, `/appointment`, `/emk/*`, `/laboratory`
- Редиректы: неавторизованных → `/login`, авторизованных с /login → /dashboard

## Этап 6 — Backend-комментарии

- `lib/mockData.ts`, `lib/labMockData.ts`, `lib/api/index.ts` — аннотированы TODO для бэкенд-разработчиков
- `types/*.ts` — контракты интерфейсов с пояснениями
- `lib/validation.ts` — правила валидации, которые должен повторить бэкенд

## Этап 7 — Деплой

### Первый деплой
- Установлен `vercel` CLI
- Прод: `https://medplatform-demo.vercel.app`
- Автоматический CI/CD через Vercel Git

### Проблемы деплоя
- В Vercel кэш не всегда корректно инвалидируется — `Remove-Item -Recurse -Force ".next"` перед сборкой
- Все 12 страниц собираются как статика (Static Generation)
- Middleware — 34.2 kB (единственный serverless-файл)

## Этап 8 — Мобильные доработки

### Горизонтальный скролл
- **Причина**: `font-sans` на appointment/laboratory переопределял Inter → шрифт менялся, контент не влезал
- **Другие причины**: `justify-between` без `min-w-0` на строках с бейджами, `overflow-x-auto` на табах
- **Фикс**: удалён `font-sans`, `justify-between` заменён на `flex gap` + `min-w-0 flex-1 truncate`

### Авто-скрытие хедера
- Добавлен `scroll` listener с определением направления
- `fixed top-0` + `-translate-y-full` при скролле вниз
- `pt-14` на всех страницах для компенсации

### Единый размер шрифтов
- Убраны `text-[22px]`, `text-[32px]`, `text-[11px]`, `text-[17px]`
- Заменены на токены темы: `text-h1`, `text-h2`, `text-label`, `text-micro`

## Этап 9 — RBAC и страницы ролей

- Реализована **ролевая модель**: `patient`, `doctor`, `admin`
- **Route groups** для пациентов — `(patient)/` (не меняет URL)
- **Прямые директории** для врача и админа: `app/doctor/*`, `app/admin/*`
  (route groups не подошли — `(doctor)/dashboard` конфликтует с `(patient)/dashboard`)
- **Middleware** проверяет `auth_token` + `role` cookie, редиректит согласно роли
- Login/Register проставляют куку `role=patient`
- Для ручного переключения: `document.cookie = "role=doctor; path=/; max-age=86400"`
- Созданы страницы:
  - **Врач** (4): дашборд со статами, пациенты, расписание, записи
  - **Админ** (5): дашборд со статами, пользователи, врачи, клиники, аудит

## Этап 10 — Data Access Layer для доктора/админа

- Мок-данные для доктора и админа перенесены из локальных массивов в `lib/mockData.ts`
- Добавлены типы: `DoctorStat`, `DoctorPatient`, `DoctorAppointment`, `AdminStat`, `AdminUser`, `AdminDoctor`, `AdminClinic`, `AdminAuditLog`
- Добавлены fetch-функции в `lib/api/index.ts`:
  - `fetchDoctorDashboardStats()`, `fetchDoctorPatients()`, `fetchDoctorSchedule()`, `fetchDoctorAppointments()`
  - `fetchAdminDashboardStats()`, `fetchAdminUsers()`, `fetchAdminDoctors()`, `fetchAdminClinics()`, `fetchAdminAuditLogs()`
- Все 9 страниц переписаны на `useQuery()` — loading-скелетоны, единый слой данных
- Теперь при подключении бэкенда достаточно изменить тело fetch-функций, вёрстка не трогается

## Этап 11 — Баги и инфраструктура

- **Favicon**: создан `app/icon.svg` (медкрест, `#178787`)
- **next.config.ts**: добавлен `images.remotePatterns` для `api.dicebear.com` и `images.unsplash.com` — без этого `next/image` падал с 500 на всех страницах с аватарками
- **Версионирование**: Vercel deploy через CLI (`npx vercel deploy --prod`), git remote не настроен

## Этап 12 — Лаборант + localStorage

- Добавлена роль `labtech` в `middleware.ts` (роут `/lab/*`, дефолт `/lab/queue`)
- Создана страница `/lab/queue` — очередь анализов для лаборанта
  - `useQuery(fetchLabQueue)` — loading/error/empty
  - Кнопка "Взять" → `updateLabTestStatus(id, "Взят")`
  - Кнопка "Результат" → модалка с формой ввода → `submitLabResult`
- Статусы анализов переведены на русский: `"Назначен" | "Взят" | "Готов"`
- `LabTest.id` изменён с `number` на `string` (консистентность с `Appointment.id`)
- Добавлено поле `LabTest.patientId: string` — привязка к пациенту
- **localStorage persistence**: `initLocalStorage()`, все lab-функции читают/пишут через LS
- Добавлен `useQueryArg<T, A>` — для fetcher'ов с аргументом
- Добавлена `createLabTest(patientId, params)` — создаёт новый тест в LS

## Этап 13 — Сквозной сценарий (частично)

- **Шаг C**: на `/doctor/appointments` добавлена кнопка "Назначить анализ" → диалог с шаблонами → `createLabTest` → запись в LS → лаборант видит в `/lab/queue`
- **Шаг D**: секция "Завершение приёма" с 3 textarea (Жалобы, Диагноз, Назначения) + кнопка "Завершить приём" (меняет статус appointment на "Завершён")
- **Результаты в ЭМК**: `EmkLabResults` компонент — таблица готовых анализов с подсветкой отклонений (красный/зелёный)
- Логин: селектор роли (Пациент / Врач / Администратор / Лаборант), редирект на дашборд роли
- Данные протекают между ролями через localStorage (без сброса при F5)

## Этап 14 — Текущее состояние

**24 статические страницы**, 0 ошибок билда, продакшен на Vercel.

### Что не сделано
- Реальные уведомления (SSE/WS)
- Тесты (E2E + unit)
- CI (GitHub Actions)
- Полноценный сквозной сценарий (визит → заметка → анализ → результат — без переключения кук вручную)
