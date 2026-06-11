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
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
        set SMARTQ_PID=%%a
    )
    if defined SMARTQ_PID (
        echo   OK: SmartQ уже запущен (:3000, PID=%SMARTQ_PID%)
    ) else (
        echo   Запускаю SmartQ...
        start "SmartQ" cmd /c "cd /d "%SMARTQ_DIR%" && npm start"
        timeout /t 8 /nobreak >nul
        for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do set SMARTQ_STARTED=%%a
        if defined SMARTQ_STARTED (echo   OK: SmartQ запущен) else (echo   ! SmartQ не запустился)
    )
) else (
    echo   ! Папка SmartQ не найдена: %SMARTQ_DIR%
)

:: ─── 3. RIS (FastAPI :8000) ────────────────────────────
echo.
echo [3/6] RIS (FastAPI :8000)...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000" ^| findstr "LISTENING"') do (
    set RIS_PID=%%a
)
if defined RIS_PID (
    echo   OK: RIS уже запущен (:8000, PID=%RIS_PID%)
) else (
    echo   Запускаю RIS (это займет время)...
    start "RIS" cmd /c "cd /d "%CD%\backend" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
    timeout /t 7 /nobreak >nul
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000" ^| findstr "LISTENING"') do set RIS_STARTED=%%a
    if defined RIS_STARTED (echo   OK: RIS запущен) else (echo   ! RIS не запустился)
)

:: ─── 4. Vite (Frontend :5173) ──────────────────────────
echo.
echo [4/6] Vite (Frontend :5173)...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
    set VITE_PID=%%a
)
if defined VITE_PID (
    echo   OK: Vite уже запущен (:5173, PID=%VITE_PID%)
) else (
    echo   Запускаю Vite...
    start "Vite" cmd /c "cd /d "%CD%\frontend" && npm run dev -- --host 0.0.0.0"
    timeout /t 6 /nobreak >nul
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do set VITE_STARTED=%%a
    if defined VITE_STARTED (echo   OK: Vite запущен) else (echo   ! Vite не запустился)
)

:: ─── 5. Yutkar Frontend (SmartQ UI :5174) ─────────
echo.
echo [5/6] Yutkar Frontend (SmartQ UI :5174)...
set YUTKAR_DIR=C:\Projects\ARCHIVE\yutkar-frontend
if exist "%YUTKAR_DIR%" (
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5174" ^| findstr "LISTENING"') do (
        set YUTKAR_PID=%%a
    )
    if defined YUTKAR_PID (
        echo   OK: Yutkar уже запущен (:5174, PID=%YUTKAR_PID%)
    ) else (
        echo   Запускаю Yutkar...
        start "Yutkar" cmd /c "cd /d "%YUTKAR_DIR%" && npm run dev -- --port 5174 --host 0.0.0.0"
        timeout /t 8 /nobreak >nul
        for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5174" ^| findstr "LISTENING"') do set YUTKAR_STARTED=%%a
        if defined YUTKAR_STARTED (echo   OK: Yutkar запущен) else (echo   ! Yutkar не запустился)
    )
) else (
    echo   ! Папка Yutkar не найдена: %YUTKAR_DIR%
)

:: ─── 6. Orthanc (DICOM PACS :8042) ─────────
echo.
echo [6/6] Orthanc (DICOM PACS :8042)...
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
) || echo   [!] RIS         :8000

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
echo  Всё готово! Открываю страницы в браузере...
echo ============================================
timeout /t 3 /nobreak >nul

:: Открыть RIS + SmartQ UI в браузере
start "" "http://localhost:5173"
timeout /t 1 /nobreak >nul
start "" "http://localhost:5174"

echo.
echo  RIS:  http://localhost:5173  (admin / admin123)
echo  SmartQ UI: http://localhost:5174 (kiosk)
echo  Orthanc: http://localhost:8042
echo.
echo  Для остановки: закройте окна CMD
echo  Или: taskkill /f /im python.exe ^&^& taskkill /f /im node.exe
echo ============================================
pause
