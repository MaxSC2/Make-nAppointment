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
echo [1/4] PostgreSQL...
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
echo [2/4] SmartQ (очередь)...
set SMARTQ_DIR=C:\Projects\ARCHIVE\smartq-back
if exist "%SMARTQ_DIR%" (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
        set SMARTQ_PID=%%a
    )
    if defined SMARTQ_PID (
        echo   OK: SmartQ уже запущен (:3000, PID=%SMARTQ_PID%)
    ) else (
        echo   Запускаю SmartQ...
        start "SmartQ" cmd /c "cd /d "%SMARTQ_DIR%" && npm start"
        timeout /t 8 /nobreak >nul
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do set SMARTQ_STARTED=%%a
        if defined SMARTQ_STARTED (echo   OK: SmartQ запущен) else (echo   ! SmartQ не запустился)
    )
) else (
    echo   ! Папка SmartQ не найдена: %SMARTQ_DIR%
)

:: ─── 3. RIS (FastAPI) ────────────────────────────
echo.
echo [3/4] RIS (FastAPI :8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    set RIS_PID=%%a
)
if defined RIS_PID (
    echo   OK: RIS уже запущен (:8000, PID=%RIS_PID%)
) else (
    echo   Запускаю RIS...
    start "RIS" cmd /c "cd /d "backend" && python -m app.main"
    timeout /t 5 /nobreak >nul
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do set RIS_STARTED=%%a
    if defined RIS_STARTED (echo   OK: RIS запущен) else (echo   ! RIS не запустился)
)

:: ─── 4. Vite (Frontend) ──────────────────────────
echo.
echo [4/4] Vite (Frontend :5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    set VITE_PID=%%a
)
if defined VITE_PID (
    echo   OK: Vite уже запущен (:5173, PID=%VITE_PID%)
) else (
    echo   Запускаю Vite...
    start "Vite" cmd /c "cd /d "frontend" && npm run dev"
    timeout /t 6 /nobreak >nul
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do set VITE_STARTED=%%a
    if defined VITE_STARTED (echo   OK: Vite запущен) else (echo   ! Vite не запустился)
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

echo.
echo ============================================
echo  Откройте в браузере: http://localhost:5173
echo  Вход: admin / admin123
echo ============================================
echo  Для остановки: закройте окна CMD
echo  Или: taskkill /f /im python.exe ^&^& taskkill /f /im node.exe
echo ============================================
pause
