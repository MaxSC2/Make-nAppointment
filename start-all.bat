@echo off
chcp 65001 >nul
title MedPlatform - Запуск всех сервисов
cd /d "%~dp0"

echo ============================================
echo  MedPlatform RIS - Запуск всех сервисов
echo ============================================
echo.

:: ─── 1. PostgreSQL ───────────────────────────────
:check_pg
echo [1/6] PostgreSQL...
pg_isready -q 2>nul
if %errorlevel% equ 0 (
    echo   OK: PostgreSQL работает
) else (
    echo   Запускаю PostgreSQL...
    net start postgresql-x64-16 2>nul || sc start postgresql-16 2>nul || echo   ! Не удалось запустить PostgreSQL
    timeout /t 3 /nobreak >nul
)

:: ─── 2. SmartQ (очередь) ─────────────────────────
echo.
echo [2/6] SmartQ (очередь)...
set SMARTQ_DIR=C:\Projects\ARCHIVE\smartq-back
if exist "%SMARTQ_DIR%" (
    set SMARTQ_PID=
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
        set SMARTQ_PID=%%a
    )
    if defined SMARTQ_PID (
        echo   OK: SmartQ уже запущен (:3000, PID=%SMARTQ_PID%)
    ) else (
        echo   Запускаю SmartQ...
        start "SmartQ" cmd /c "cd /d "%SMARTQ_DIR%" && npm start"
        timeout /t 8 /nobreak >nul
        set SMARTQ_STARTED=
        for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do set SMARTQ_STARTED=%%a
        if defined SMARTQ_STARTED (echo   OK: SmartQ запущен) else (echo   ! SmartQ не запустился)
    )
) else (
    echo   ! Папка SmartQ не найдена: %SMARTQ_DIR%
)

:: ─── 3. RIS (FastAPI) ────────────────────────────
echo.
echo [3/6] RIS (FastAPI)...
set RIS_PID=
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000" ^| findstr "LISTENING"') do (
    set RIS_PID=%%a
)
if defined RIS_PID (
    echo   OK: RIS уже запущен (:8000, PID=%RIS_PID%)
) else (
    echo   Проверяю ghost-сокеты на :8000...
    set RIS_GHOST=
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000" ^| findstr "LISTENING"') do (
        for /f "tokens=2" %%b in ('tasklist /fi "PID eq %%a" 2^>nul ^| findstr %%a') do set RIS_GHOST=%%b
    )
    if defined RIS_GHOST (
        echo   ! Ghost-сокет PID=%RIS_GHOST% блокирует :8000, использую :8001
        echo   Запускаю RIS на 8001...
        start "RIS" cmd /c "cd /d "%CD%\backend" && python -m uvicorn ris.main:app --host 0.0.0.0 --port 8001"
        timeout /t 7 /nobreak >nul
        set RIS_STARTED=
        for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8001" ^| findstr "LISTENING"') do set RIS_STARTED=%%a
        if defined RIS_STARTED (echo   OK: RIS запущен на :8001) else (echo   ! RIS не запустился)
    ) else (
        echo   Запускаю RIS (это займет время)...
        start "RIS" cmd /c "cd /d "%CD%\backend" && python -m uvicorn ris.main:app --host 0.0.0.0 --port 8000"
        timeout /t 7 /nobreak >nul
        set RIS_STARTED=
        for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000" ^| findstr "LISTENING"') do set RIS_STARTED=%%a
        if defined RIS_STARTED (echo   OK: RIS запущен на :8000) else (echo   ! RIS не запустился)
    )
)

:: ─── 4. Vite (Frontend :5173) ──────────────────────────
echo.
echo [4/6] Vite (Frontend :5173)...
set VITE_PID=
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
    set VITE_PID=%%a
)
if defined VITE_PID (
    echo   OK: Vite уже запущен (:5173, PID=%VITE_PID%)
) else (
    echo   Запускаю Vite...
    start "Vite" cmd /c "cd /d "%CD%\frontend" && npm run dev -- --host 0.0.0.0"
    timeout /t 8 /nobreak >nul
    set VITE_STARTED=
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do set VITE_STARTED=%%a
    if defined VITE_STARTED (echo   OK: Vite запущен) else (echo   ! Vite не запустился)
)

:: ─── 5. Yutkar Frontend (SmartQ UI :5174) ─────────
echo.
echo [5/6] Yutkar Frontend (SmartQ UI :5174)...
set YUTKAR_DIR=C:\Projects\ARCHIVE\yutkar-frontend
if exist "%YUTKAR_DIR%" (
    set YUTKAR_PID=
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5174" ^| findstr "LISTENING"') do (
        set YUTKAR_PID=%%a
    )
    if defined YUTKAR_PID (
        echo   OK: Yutkar уже запущен (:5174, PID=%YUTKAR_PID%)
    ) else (
        echo   Запускаю Yutkar...
        start "Yutkar" cmd /c "cd /d "%YUTKAR_DIR%" && npm run dev -- --port 5174 --host 0.0.0.0"
        timeout /t 8 /nobreak >nul
        set YUTKAR_STARTED=
        for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5174" ^| findstr "LISTENING"') do set YUTKAR_STARTED=%%a
        if defined YUTKAR_STARTED (echo   OK: Yutkar запущен) else (echo   ! Yutkar не запустился)
    )
) else (
    echo   ! Папка Yutkar не найдена: %YUTKAR_DIR%
)

:: ─── 6. Orthanc (DICOM PACS :8042) ─────────
echo.
echo [6/6] Orthanc (DICOM PACS :8042)...
set ORTHANC_PID=
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8042" ^| findstr "LISTENING"') do (
    set ORTHANC_PID=%%a
)
if defined ORTHANC_PID (
    echo   OK: Orthanc уже запущен (:8042, PID=%ORTHANC_PID%)
) else (
    echo   Note: Orthanc запущен как Windows Service (Orthanc)
    sc query Orthanc 2>nul | findstr "RUNNING" >nul && echo   OK: Orthanc Service активен || echo   ! Orthanc Service неактивен
)

:: ─── Итог ────────────────────────────────────────
echo.
echo ============================================
echo  Проверка статуса:
echo ============================================
echo.

:: PostgreSQL
pg_isready -q 2>nul && echo   [OK] PostgreSQL  :5432 || echo   [!] PostgreSQL  :5432

:: SmartQ
netstat -aon 2>nul | findstr ":3000" | findstr "LISTENING" >nul && (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do echo   [OK] SmartQ      :3000 (PID %%a)
) || echo   [!] SmartQ      :3000

:: RIS
netstat -aon 2>nul | findstr ":8000" | findstr "LISTENING" >nul && (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do echo   [OK] RIS         :8000 (PID %%a)
) || (
    netstat -aon 2>nul | findstr ":8001" | findstr "LISTENING" >nul && (
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8001" ^| findstr "LISTENING"') do echo   [OK] RIS         :8001 (PID %%a, fallback)
    ) || echo   [!] RIS         :8000/8001
)

:: Vite
netstat -aon 2>nul | findstr ":5173" | findstr "LISTENING" >nul && (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do echo   [OK] Vite        :5173 (PID %%a)
) || echo   [!] Vite        :5173

:: Yutkar
netstat -aon 2>nul | findstr ":5174" | findstr "LISTENING" >nul && (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5174" ^| findstr "LISTENING"') do echo   [OK] Yutkar UI   :5174 (PID %%a)
) || echo   [!] Yutkar UI   :5174

:: Orthanc
netstat -aon 2>nul | findstr ":8042" | findstr "LISTENING" >nul && (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8042" ^| findstr "LISTENING"') do echo   [OK] Orthanc     :8042 (PID %%a)
) || (
    sc query Orthanc 2>nul | findstr "RUNNING" >nul && echo   [OK] Orthanc     :8042 (Service) || echo   [!] Orthanc     :8042
)

echo.
echo ============================================
echo  Всё готово! Открываю страницы в Chrome...
echo ============================================
timeout /t 2 /nobreak >nul

:: ─── Открыть все страницы в Chrome ─────────────────────
:: Главная страница RIS
start "" "http://localhost:5173/"
timeout /t 1 /nobreak >nul

:: Кабинет врача
start "" "http://localhost:5173/doctor"
timeout /t 1 /nobreak >nul

:: Исследования (с кнопкой 'Очистка PACS')
start "" "http://localhost:5173/studies"
timeout /t 1 /nobreak >nul

:: Заказы
start "" "http://localhost:5173/orders"
timeout /t 1 /nobreak >nul

:: Пациенты
start "" "http://localhost:5173/patients"
timeout /t 1 /nobreak >nul

:: Мониторинг
start "" "http://localhost:5173/monitoring"
timeout /t 1 /nobreak >nul

:: Регистрация
start "" "http://localhost:5173/register"
timeout /t 1 /nobreak >nul

:: SmartQ UI (Kiosk)
start "" "http://localhost:5174"
timeout /t 1 /nobreak >nul

:: RIS API Swagger
start "" "http://localhost:8000/docs"
timeout /t 1 /nobreak >nul

:: Orthanc UI
start "" "http://localhost:8042"

echo.
echo ============================================
echo  Страницы открыты в Chrome:
echo ============================================
echo.
echo  RIS UI:
echo    http://localhost:5173/             Главная (Очередь)
echo    http://localhost:5173/doctor       Кабинет врача
echo    http://localhost:5173/studies      Исследования + Очистка
echo    http://localhost:5173/orders       Заказы
echo    http://localhost:5173/patients     Пациенты
echo    http://localhost:5173/monitoring   Мониторинг
echo    http://localhost:5173/register     Регистрация
echo.
echo  SmartQ UI (Kiosk):
echo    http://localhost:5174
echo.
echo  API + PACS:
echo    http://localhost:8000/docs         RIS Swagger
echo    http://localhost:8042              Orthanc
echo.
echo  Логины:
echo    admin    / admin123
echo    doctor_t / doctor123
echo    registrar_t / registrar123
echo.
echo  Для остановки: закройте окна CMD
echo  Или: taskkill /f /im python.exe ^&^& taskkill /f /im node.exe
echo ============================================
pause
