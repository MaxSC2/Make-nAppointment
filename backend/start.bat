@echo off
chcp 65001 > nul
REM ============================================================
REM  Запуск PACS-RIS-Queue (PostgreSQL + FastAPI)
REM ============================================================
echo.
echo ============================================================
echo   PACS-RIS + Электронная очередь (PostgreSQL edition)
echo ============================================================
echo.

REM 1. Создаём .env из .env.example, если его нет
if not exist ".env" (
    echo [1/6] Создаю .env из шаблона...
    copy .env.example .env > nul
) else (
    echo [1/6] .env уже существует
)

REM 2. Устанавливаем зависимости
echo.
echo [2/6] Установка Python-зависимостей...
python -m pip install -q -r requirements.txt
if errorlevel 1 (
    echo   ОШИБКА: pip install завершился с ошибкой
    pause
    exit /b 1
)

REM 3. Поднимаем PostgreSQL в Docker
echo.
echo [3/6] Запуск PostgreSQL (docker compose)...
where docker > nul 2>&1
if errorlevel 1 (
    echo   Docker не найден в PATH. Установи Docker Desktop либо подними
    echo   PostgreSQL вручную и задай DATABASE_URL в .env
    pause
    exit /b 1
)
docker compose up -d postgres
if errorlevel 1 (
    echo   ОШИБКА: docker compose не смог поднять postgres
    pause
    exit /b 1
)

REM 4. Ждём готовности БД
echo   Ожидаю готовности PostgreSQL...
:wait_pg
docker compose exec -T postgres pg_isready -U pacs -d pacs_ris > nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak > nul
    goto wait_pg
)
echo   PostgreSQL готов.

REM 5. Миграции + начальные данные
echo.
echo [4/6] Применение миграций Alembic...
python -m alembic upgrade head
if errorlevel 1 (
    echo   ОШИБКА: миграции не применились
    pause
    exit /b 1
)

echo.
echo [5/6] Инициализация справочников и админа...
python -m db.init_db
if errorlevel 1 (
    echo   ОШИБКА: init_db завершился с ошибкой
    pause
    exit /b 1
)

REM 6. Поднимаем Orthanc и сервисы
echo.
echo [6/6] Запуск Orthanc и FastAPI-сервисов...
if exist "orthanc\Orthanc.exe" (
    start "Orthanc" cmd /c "cd orthanc && Orthanc.exe orthanc.json"
    echo   Orthanc:    http://localhost:8042
) else (
    echo   Orthanc.exe не найден — пропускаю ^(сервисы будут работать без PACS^)
)

start "RIS"   cmd /c "uvicorn ris.main:app    --port 8000 --host 0.0.0.0"
start "Queue" cmd /c "uvicorn elqueue.main:app --port 8005 --host 0.0.0.0"

echo.
echo ============================================================
echo   Готово! Сервисы:
echo ============================================================
echo   PostgreSQL:       localhost:5432   (pacs / pacs_secret)
echo   pgAdmin:          http://localhost:5050  ^(только с --profile gui^)
echo   Orthanc (PACS):   http://localhost:8042
echo   RIS API:          http://localhost:8000/docs
echo   Эл. очередь:      http://localhost:8005
echo   Панель врача:     http://localhost:8005/admin
echo   Список иссл.:     http://localhost:8000/studies
echo   Swagger RIS:      http://localhost:8000/docs
echo   Swagger Queue:    http://localhost:8005/docs
echo.
echo   Логин:   admin
echo   Пароль:  admin123
echo.
echo   Нажмите любую клавишу для остановки всех сервисов...
pause > nul

taskkill /f /im Orthanc.exe > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq RIS*"   > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Queue*" > nul 2>&1
