# ⚠️ КУДА ПИСАТЬ КОД И КОММИТИТЬ

> **Единственный актуальный путь проекта:** `C:\Projects\ARCHIVE\MedPlatform\`
> Это git-репозиторий. Все правки, тесты и `git push` — **только здесь**.

---

## Структура папок в `C:\Projects\`

| Папка | Что это | Можно редактировать? |
|---|---|---|
| `C:\Projects\ARCHIVE\MedPlatform\` | ✅ **Активный проект** (git) | **ДА** — пишем код, коммитим, пушим |
| `C:\Projects\pacs-ris-queue\` | ⚠️ Workspace бэкенда (другого AI, **без git**) | **НЕТ** — только читаем, копируем оттуда в ARCHIVE/MedPlatform |
| `C:\Projects\MedPlatform\` | ❌ **Устаревшая пустая копия** | **НЕТ** — не трогать, не коммитить |
| `C:\Projects\RIS-PACS-extracted\` | 📦 Архив (для справки) | НЕТ |
| `C:\Projects\RIS-PACS-temp\` | 📦 Временная (для справки) | НЕТ |
| `C:\Projects\ARCHIVE\` | 📦 Архив | НЕТ |

---

## Как работать

### Frontend + доки
```powershell
Set-Location C:\Projects\ARCHIVE\MedPlatform
npm run dev
# http://localhost:5173
```

### Backend (правки идут через две папки)
1. Другой AI пишет бэк в `C:\Projects\pacs-ris-queue\`
2. Мы **копируем** нужные файлы из `pacs-ris-queue\ris\`, `pacs-ris-queue\elqueue\`, `pacs-ris-queue\db\` → в `ARCHIVE\MedPlatform\backend\...`
3. Коммитим и пушим из `ARCHIVE\MedPlatform`

### Проверить, что ты в нужной папке
```powershell
cd C:\Projects\ARCHIVE\MedPlatform
git log --oneline -1
# Должен показать последний коммит, например:
# 447a04e fix(dwv): always set Draw shape on tool change
```

Если `git log` ругается "not a git repository" — **ты не в той папке**.

---

## Запуск сервисов

```powershell
Set-Location C:\Projects\ARCHIVE\MedPlatform\backend

# Запуск PostgreSQL (Docker)
docker compose up -d postgres

# Запуск RIS (порт 8000)
python -m uvicorn ris.main:app --port 8000 --host 0.0.0.0

# Запуск elqueue (порт 8005)
python -m uvicorn elqueue.main:app --port 8005 --host 0.0.0.0

# Запуск Orthanc
.\orthanc\Orthanc.exe orthanc.json

# Запуск фронта (в отдельном окне)
Set-Location C:\Projects\ARCHIVE\MedPlatform\frontend
npm run dev
```

**Логин:** `admin` / `admin123`

---

## Репозиторий на GitHub
`https://github.com/MaxSC2/Make-nAppointment.git` — пуш идёт от `ARCHIVE/MedPlatform`.
