# MedPlatform — Frontend

Медицинское веб-приложение. Frontend на Next.js 15.

## Стек

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- lucide-react (иконки)

## Запуск

```bash
npm install
npx next dev --port 3000
```

Открыть http://localhost:3000

## Сборка

```bash
npx next build
```

## Роли и вход

На странице `/login` можно выбрать роль и войти без регистрации (мок-режим).

| Роль | Логин | Что видит |
|---|---|---|
| Пациент | `patient` | Запись к врачу, EMR, лаборатория |
| Врач | `doctor` | Пациенты, расписание, приёмы |
| Админ | `admin` | Пользователи, клиники, аудит |
| Лаборант | `labtech` | Очередь анализов |

## Структура папок

```
app/
  (patient)/     # Пациентские страницы
  doctor/        # Врачебные страницы
  admin/         # Админка
  lab/           # Лаборант
components/      # Переиспользуемые компоненты
lib/             # Моки, API-хуки, валидация
types/           # TypeScript типы
docs/            # Документация
```

## API (мок-режим)

Сейчас все данные — моки из `lib/mockData.ts` и `lib/labMockData.ts`.
Запросы идут через `lib/api/index.ts` с задержкой 300ms.
Лабораторные данные хранятся в `localStorage` (ключ `lab_tests`).

Для перехода на реальный бэкенд — заменить тела функций в `lib/api/index.ts` на реальные fetch.

## Данные для лаборатории

Лаб-тесты создаются врачом на странице `/doctor/appointments`, попадают в localStorage, отображаются у лаборанта на `/lab/queue`. После заполнения результата — статус меняется на «Готов», результат виден пациенту в EMR и лаборатории.

## Деплой

https://medplatform-demo.vercel.app
