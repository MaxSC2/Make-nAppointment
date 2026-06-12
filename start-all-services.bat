@echo off
chcp 65001 > nul
REM ============================================================
    REM  Универсальный оркестратор запуска MedPlatform
    REM  RIS (:8000), Queue (:8005), Vite (:5173),
    REM  Orthanc (:8042), SmartQ Backend (:3000), SmartQ Frontend (:5174)
REM ============================================================

echo.
echo ============================================================
echo   MEDPLATFORM RIS + SmartQ — автозапуск
echo ============================================================
echo.

REM Проверка корневой папки
if not exist "frontend" (
    echo   ОШИБКА: Запуск из корня проекта C:\Projects\ARCHIVE\MedPlatform!
    echo   Текущая: %CD%
    pause
    exit /b 1
)

REM 1. Очистка портов
echo [1/5] Очистка портов...
powershell -Command "
$ports = @(8000, 8005, 5173, 3000, 8042);
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue;
    if ($conn) {
        Write-Host \"  Порт $port занят (PID $($conn[0].OwningProcess)). Освобождаю...\" -ForegroundColor Yellow;
        Stop-Process -Id $conn[0].OwningProcess -Force -ErrorAction SilentlyContinue;
    }
}
Start-Sleep 2
"

REM 2. PostgreSQL
echo [2/5] Проверка PostgreSQL...
where docker > nul 2>&1
if errorlevel 1 (
    echo   Docker не найден. Считаем что PostgreSQL уже на :5432.
) else (
    cd backend
    docker compose up -d postgres 2>nul
    echo   PostgreSQL готов.
    cd ..
)

REM 3. Миграции
echo [3/5] Миграции RIS...
cd backend
python -m alembic upgrade head > nul 2>&1
cd ..

REM 4. SmartQ миграции (Prisma)
echo [4/5] Миграции SmartQ...
cd ..\smartq-back
npx prisma migrate deploy > nul 2>&1
cd ..\MedPlatform

REM 5. Запуск сервисов
echo [5/5] Запуск сервисов...

REM А. Orthanc PACS
if exist "backend\orthanc\Orthanc.exe" (
    start "Orthanc PACS" cmd /c "cd backend\orthanc && Orthanc.exe orthanc.json"
    echo   [+] Orthanc :8042
)

REM Б. FastAPI RIS
start "RIS :8000" cmd /c "cd backend && python -m uvicorn ris.main:app --port 8000 --host 0.0.0.0 --reload"
echo   [+] RIS :8000/docs

REM В. FastAPI Queue (elqueue fallback)
start "Queue :8005" cmd /c "cd backend && python -m uvicorn elqueue.main:app --port 8005 --host 0.0.0.0 --reload"
echo   [+] Queue :8005/docs

REM Г. SmartQ Backend (NestJS)
start "SmartQ :3000" cmd /c "cd ..\smartq-back && npm run start:dev"
echo   [+] SmartQ :3000/api/docs

REM Д. Vite Frontend
start "Vite :5173" cmd /c "cd frontend && npm run dev"
echo   [+] Vite :5173

echo.
echo ============================================================
echo   ГОТОВО! (через ~10 сек сервисы поднимутся)
echo ============================================================
echo   Вход:    http://localhost:5173/login
echo   Логин:   admin / admin123
echo.
echo   SmartQ:  http://localhost:3000/api/docs
echo   RIS:     http://localhost:8000/docs
echo   Queue:   http://localhost:8005/docs
echo   Orthanc: http://localhost:8042
echo.
echo   Нажми любую клавишу — ОСТАНОВИТЬ всё
echo ============================================================
pause > nul

echo Остановка...
taskkill /f /im Orthanc.exe > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq RIS :8000" > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Queue :8005" > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq SmartQ :3000" > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Vite :5173" > nul 2>&1
powershell -Command "
$ports = @(8000, 8005, 5173, 3000);
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue;
    if ($conn) { Stop-Process -Id $conn[0].OwningProcess -Force; }
}
Start-Sleep 1
"
echo Всё остановлено.
timeout /t 2 > nul
