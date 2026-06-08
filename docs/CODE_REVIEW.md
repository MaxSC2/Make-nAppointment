# Code Review: MedPlatform

> Дата: 26.05.2026
> Методология: инспекция кода 3 агентами (типы/API, страницы, компоненты)
> Изменения: НЕ вносились — только отчёт

---

## Условные обозначения

| Метка | Значение |
|-------|----------|
| 🔴 CRITICAL | Баг в рантайме, потеря данных, безопасность |
| 🟠 HIGH | Серьёзная проблема, требует исправления |
| 🟡 MEDIUM | Нарушение best practices, потенциальный баг |
| 🔵 LOW | Косметика, рефакторинг, улучшайзинг |
| ℹ️ INFO | Наблюдение без немедленных последствий |

---

## 1. 🔴 CRITICAL

### 1.1. `lib/api/hooks.ts` — Race condition при смене зависимостей

Когда `deps` меняются, создаётся новый `execute` через `useCallback`, эффект запускает новый fetch, но **предыдущий fetch из старых deps всё ещё в полёте**. Когда он разрешается, он вызывает `setState` и перезаписывает актуальные данные устаревшими. **Нет `AbortController`, нет отмены запросов.**

### 1.2. `lib/api/hooks.ts` — Нет cleanup при unmount

`useEffect` не возвращает функцию очистки. Если компонент размонтируется до завершения fetch, промис всё равно вызовет `setState` на размонтированном компоненте (warning в React 18+).

### 1.3. `components/ui/CalendarGrid.tsx` — Индекс массива как key (строка 139)

```tsx
{days.map((d, idx) => (
  <button key={idx} ... />
))}
```

При смене месяца длина массива days может остаться 42, но содержимое меняется. React переиспользует DOM-узлы по индексу → визуальные глитчи (подсветка не того дня, потеря фокуса). **Fix:** `key={d.toISOString()}`.

---

## 2. 🟠 HIGH

### 2.1. `app/login/page.tsx` — Хардкод пароля в разметке

```tsx
defaultValue="password"  // строка 116
defaultValue="920512450123"  // строка 106
```

Демо-учётка видна в HTML-коде. На продакшене это недопустимо. Плюс кука `auth_token=mock-token-123` без `Secure`, `HttpOnly`, `SameSite`.

### 2.2. `lib/api/hooks.ts` — Нет фонового refetch

`execute()` всегда сбрасывает `data` в `null` и показывает loading. Нельзя сделать бесшовный фоновый рефреш — только полный loading flash.

### 2.3. `components/appointment/DoctorCard.tsx` — Кликабельный `<div>` без клавиатуры

Карточка врача — `<div onClick={...}>` без `role="button"`, `tabIndex`, `onKeyDown`. Клавиатурные пользователи не могут выбрать врача.

### 2.4. `components/layout/Header.tsx` — Очистка куки не сработает

```ts
document.cookie = "auth_token=; path=/; max-age=0";
```

Если оригинальная кука была установлена с `Secure` или `HttpOnly`, эта запись создаёт *другую* куку, а оригинал остаётся. `clearAuth()` не работает.

### 2.5. `app/globals.css` — Анимация `fadeUp` не определена

`animate-[fadeUp_0.3s_ease]` используется в `appointment/page.tsx` (модалки), но `@keyframes fadeUp` отсутствует в CSS.

### 2.6. `app/appointment/page.tsx` — `useEffect` может вызывать infinite re-render

```tsx
useEffect(() => {
  if (apptsQuery.data) setAppointments(apptsQuery.data);
}, [apptsQuery.data]);
```

Если `apptsQuery.data` — новый массив при каждом рендере, эффект будет циклиться.

### 2.7. `components/layout/MobileNav.tsx` — Использует `<a>` вместо `<Link>`

Все 4 ссылки в MobileNav — `<a href="...">`. Это full-page навигация вместо SPA: теряется состояние, происходит полная перезагрузка.

---

## 3. 🟡 MEDIUM

### 3.1. Типы и данные

- `AppointmentStatus` не включает `"cancelled"`, хотя комментарий в `mockData.ts` его упоминает
- `Appointment` не хранит `phone`, `complaints`, `appointmentType` — данные теряются при создании
- `Doctor.id: string` vs `Appointment.id: number` — несогласованность
- `LabTest.hasFile` помечен `?` но всегда присутствует в моках

### 3.2. Валидация

- **Нет проверки длины** surname/name (2-50 символов — не реализовано)
- **Пароль без complexity** (нет upper/digit/special)
- **Нет поля подтверждения пароля** при регистрации
- **Логин** не проверяет формат (ИИН или email)
- **IIN** не проверяет контрольную сумму — `000000000000` проходит
- **Валидация формы записи** размазана: часть в `validation.ts`, часть в `handleConfirmBooking`

### 3.3. `useQuery` и API

- `fetchTimeSlots` — dead export, никто не вызывает
- `fetcher` отсутствует в deps `useCallback` (подавлен eslint-disable)
- Нет различения initial load и refetch (всегда loading flash)
- Нет `AbortSignal` в сигнатуре `fetcher`

### 3.4. Middleware

- `authRoutes.includes(pathname)` — exact match, не захватит `/login/reset-password`
- Любое значение cookie проходит проверку (нет валидации токена)
- Паттерн matcher исключает `*.bak` — странно для медицинского приложения

### 3.5. CalendarGrid

- `busyDates?: Date[]` — объявлен в пропсах, но **никогда не используется** в рендере
- `isFutureAllowed` — вычисляется (строки 90-93) и **никогда не используется**
- `today = useMemo(() => getToday(), [])` — замокана на момент монтирования; после полуночи не обновляется

### 3.6. Accessibility

- Кнопки уведомлений и аватара без `aria-label`, `aria-expanded`, `aria-haspopup`
- Дропдауны без `role="menu"`, `role="dialog"`
- Календарь без `role="grid"`, `role="gridcell"`, `aria-selected`
- Все модалки без фокус-трапа, без `role="dialog"`, без `aria-modal`
- MobileNav без `aria-current="page"`, без `aria-label` на `<nav>`
- DoctorCard — звезда рейтинга без `aria-hidden="true"`
- Метки форм без `htmlFor` / inputs без `id`

### 3.7. Дублирование кода

- `ErrorBlock` — идентичный код в `appointment/page.tsx` и `laboratory/page.tsx`
- `Skeleton` / `TestSkeleton` — дублируется
- Стили табов — в `visits`, `prescriptions`, `appointment` — почти одинаковые
- `Header` и `MobileHeader` — 80% дублирования (уведомления, меню, аватар)

### 3.8. Хардкод данных

- Приветствие «Асель» и текст напоминания на дашборде — хардкод
- Имя пациента в сайдбаре — хардкод
- Годы в фильтре визитов — `"2024"` и `"2023"`
- Год в футере — `"2026"`, не динамический

### 3.9. Прочее

- `useClickOutside` — handler пересоздаётся каждый рендер (стрелочные функции), эффект лишний раз перемонтируется
- Scroll listener хедера без throttle (но `{ passive: true }`)
- `<img>` вместо `<Image>` из next — нет lazy loading, оптимизации
- `href="#"` в 4 местах (восстановление пароля, оферта, политика, «Подробнее»)
- `/emk/page.tsx` — `visit` использует `key={diagnosis + date}` (коллизия при одинаковых значениях)
- `/emk/visits/page.tsx` — `key={idx}` (индекс массива)
- `specFilter2` — странное имя, намекает на копипасту
- Размеры шрифтов в `px` вместо `rem` (не масштабируются при настройках браузера)
- Нет `dir="ltr"` на `<html>`
- Нет favicon / theme-color / viewport мета-тегов

---

## 4. 🔵 LOW

- `null` → `null` → кнопки «Посмотреть» / «Скачать» в лаборатории без `onClick`
- Нет `loading` state на кнопке «Подтвердить запись» (двойной сабмит)
- Чекбокс «Запомнить» на логине — dead UI (не читается и не отправляется)
- `Date.now()` как ID записи — не уникально для прода
- `FormData.get("phone")` — строковые ключи, ломаются при смене `name` на инпуте
- `<a>` вместо `<Link>` в `/emk/page.tsx` (ссылка «Все визиты»)
- `NavIcon` в MobileNav — dead case `"user"` (не используется)
- `EmkSidebar` — ссылки продублированы в `links` и `tabs`
- Фильтр визитов — три `.filter()` подряд вместо одного с условиями
- Нет `loading` состояния для вкладки «Мои записи» в appointment
- Нет empty state для направлений в prescriptions

---

## 5. Итого

| Уровень | Количество |
|---------|-----------|
| 🔴 CRITICAL | 3 |
| 🟠 HIGH | 7 |
| 🟡 MEDIUM | ~30 |
| 🔵 LOW | ~20 |

### Топ-10, что чинить в первую очередь

1. 🔴 `useQuery` — race condition + нет cleanup (потеря данных, утечка памяти)
2. 🔴 `CalendarGrid` — key по индексу (глитчи при смене месяца)
3. 🟠 Login — хардкод пароля и кука без флагов (безопасность)
4. 🟠 `DoctorCard` — `<div>` без клавиатуры (a11y, баг)
5. 🟠 `clearAuth()` — не очищает куку (баг)
6. 🟠 `fadeUp` не определён в CSS (визуальный баг)
7. 🟠 `useEffect` в appointment — потенциальный infinite loop
8. 🟠 MobileNav — `<a>` вместо `<Link>` (потеря SPA)
9. 🟡 CalendarGrid — `busyDates` и `isFutureAllowed` dead code
10. 🟡 Валидация — нет confirm password, нет длины полей, нет complexity пароля
