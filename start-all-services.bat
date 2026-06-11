@echo off
chcp 65001 > nul
REM ============================================================
    REM  Универсальный оркестратор запуска MedPlatform
    REM  Запускает: RIS (:8000), Queue (:8005), Vite Front (:5173),
    REM  Orthanc (:8042), NestJS Backend (:3000), NestJS Viewer Static (:5550)
REM ============================================================

echo.
echo ============================================================
echo   MEDPLATFORM - Единый оркестратор автозапуска (Full Stack)
echo ============================================================
echo.

REM Проверка корневой папки
if not exist "frontend" (
    echo   ОШИБКА: Запуск должен производиться из корня проекта!
    echo   Текущая директория: %CD%
    pause
    exit /b 1
)

REM 1. Очистка портов от зависших процессов
echo [1/5] Проверка и очистка занятых портов...
powershell -Command "
$ports = @(8000, 8005, 5173, 3000, 5550, 8042);
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue;
    if ($conn) {
        Write-Host \"  Порт $port занят. Принудительно завершаю процесс PID $($conn[0].OwningProcess)...\" -ForegroundColor Yellow;
        Stop-Process -Id $conn[0].OwningProcess -Force -ErrorAction SilentlyContinue;
    }
}
"

REM 2. Настройка бэкенда (.env)
echo [2/5] Проверка окружения бэкенда...
if not exist "backend\.env" (
    echo   Создаю backend\.env из backend\.env.example...
    copy backend\.env.example backend\.env > nul
)

REM 3. Поднятие СУБД PostgreSQL в Docker
echo [3/5] Запуск СУБД PostgreSQL...
where docker > nul 2>&1
if errorlevel 1 (
    echo   ВНИМАНИЕ: Docker не найден. Убедитесь, что PostgreSQL запущен на порту 5432!
) else (
    cd backend
    docker compose up -d postgres
    echo   Ожидаю готовности PostgreSQL...
    :wait_pg
    docker compose exec -T postgres pg_isready -U pacs -d pacs_ris > nul 2>&1
    if errorlevel 1 (
        timeout /t 1 /nobreak > nul
        goto wait_pg
    )
    echo   PostgreSQL готов.
    cd ..
)

REM 4. Применение миграций и инициализация
echo [4/5] Подготовка базы данных RIS/Queue...
cd backend
python -m pip install -q -r requirements.txt > nul 2>&1
python -m alembic upgrade head > nul 2>&1
python -m db.init_db > nul 2>&1
cd ..

REM 5. Параллельный запуск всех 6 микросервисов в отдельных окнах
echo [5/5] Запуск микросервисов...

REM А. Orthanc PACS
if exist "backend\orthanc\Orthanc.exe" (
    start "Orthanc PACS" cmd /c "cd backend\orthanc && Orthanc.exe orthanc.json"
    echo   [+] Orthanc PACS запущен на http://localhost:8042
) else (
    echo   [-] Orthanc.exe не найден. Пропускаю локальный PACS.
)

REM Б. FastAPI RIS бэкенд
start "FastAPI RIS :8000" cmd /c "cd backend && uvicorn ris.main:app --port 8000 --host 0.0.0.0"
echo   [+] FastAPI RIS бэкенд запущен на http://localhost:8000/docs

REM В. FastAPI Queue бэкенд
start "FastAPI Queue :8005" cmd /c "cd backend && uvicorn elqueue.main:app --port 8005 --host 0.0.0.0"
echo   [+] FastAPI Queue бэкенд запущен на http://localhost:8005/docs

REM Г. Vite React фронтенд
start "Vite Frontend :5173" cmd /c "cd frontend && npm run dev"
echo   [+] Vite React фронтенд запущен на http://localhost:5173

REM Д. NestJS DICOMweb прокси
set NEST_DIR=C:\Users\Пользователь\AppData\Local\Temp\opencode\ris-pacs-rar\RIS PACS\backend
if exist "%NEST_DIR%" (
    start "NestJS DICOMweb :3000" cmd /c "cd /d \"%NEST_DIR%\" && node dist\main.js"
    echo   [+] NestJS DICOMweb прокси запущен на http://localhost:3000
) else (
    echo   [-] NestJS директория не найдена. Полный просмотрщик будет недоступен.
)

REM Е. Статический сервер NestJS вьювера
set FE_DIR=C:\Users\Пользователь\AppData\Local\Temp\opencode\ris-pacs-rar\RIS PACS\frontend
if exist "%FE_DIR%" (
    start "NestJS Viewer FE :5550" cmd /c "cd /d \"%FE_DIR%\" && python -m http.server 5550 --bind 127.0.0.1"
    echo   [+] NestJS вьювер запущен на http://localhost:5550/viewer.html
)

echo.
echo ============================================================
echo   ВСЕ СЕРВИСЫ УСПЕШНО ЗАПУЩЕНЫ!
echo ============================================================
echo   Адрес входа в систему:  http://localhost:5173/login
echo   Логин / Пароль:         admin / admin123
echo.
echo   Для завершения РАБОТЫ и остановки всех процессов
echo   нажмите ЛЮБУЮ клавишу в этом окне...
echo ============================================================
pause > nul

echo Останавливаю фоновые процессы...
taskkill /f /im Orthanc.exe > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq FastAPI RIS*" > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq FastAPI Queue*" > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Vite Frontend*" > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq NestJS DICOMweb*" > nul 2>&1
taskkill /f /fi "WINDOWTITLE eq NestJS Viewer FE*" > nul 2>&1
powershell -Command "
$ports = @(8000, 8005, 5173, 3000, 5550);
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue;
    if ($conn) { Stop-Process -Id $conn[0].OwningProcess -Force -ErrorAction SilentlyContinue; }
}
"
echo Все процессы остановлены. Выход.
timeout /t 2 > nul
