@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
title MedPlatform — All Services
cd /d "%~dp0"
set "ROOT=%CD%"

echo.
echo ============================================================
echo   MEDPLATFORM RIS + SmartQ — запуск всех сервисов
echo ============================================================
echo.

REM 1. Чистка портов
echo [1/5] Очистка портов...
powershell -NoProfile -Command "
$ports = @(8000, 8005, 5173, 3000, 8042);
foreach ($p in $ports) {
    $c = Get-NetTCPConnection -LocalPort $p -EA 0;
    if ($c) { Stop-Process -Id $c[0].OwningProcess -Force -EA 0; Write-Host \"  Port $p freed\" }
}
Start-Sleep 2
"

REM 2. Миграции
echo [2/5] Миграции RIS...
cd /d "%ROOT%\backend"
python -m alembic upgrade head > nul 2>&1
cd /d "%ROOT%"

echo [3/5] Миграции SmartQ...
cd /d "%ROOT%\..\smartq-back"
call npx prisma migrate deploy > nul 2>&1
cd /d "%ROOT%"

REM 3. Запуск сервисов (в отдельных окнах)
echo [4/5] Запуск сервисов...

start "Orthanc PACS" cmd /c "cd /d %ROOT%\backend\orthanc && Orthanc.exe orthanc.json"
echo   [+] Orthanc :8042
timeout /t 1 /nobreak > nul

start "RIS :8000" cmd /c "cd /d %ROOT%\backend && python -m uvicorn ris.main:app --host 0.0.0.0 --port 8000 --reload"
echo   [+] RIS :8000
timeout /t 2 /nobreak > nul

start "Queue :8005" cmd /c "cd /d %ROOT%\backend && python -m uvicorn elqueue.main:app --host 0.0.0.0 --port 8005 --reload"
echo   [+] Queue :8005
timeout /t 2 /nobreak > nul

start "SmartQ Backend" cmd /c "cd /d %ROOT%\..\smartq-back && npm run start:dev"
echo   [+] SmartQ Backend :3000
timeout /t 5 /nobreak > nul

start "SmartQ Frontend" cmd /c "cd /d %ROOT%\..\yutkar-frontend && npm run dev"
echo   [+] SmartQ Frontend :5174
timeout /t 2 /nobreak > nul

start "RIS Frontend" cmd /c "cd /d %ROOT%\frontend && npm run dev"
echo   [+] RIS Frontend :5173

REM 4. Ждём и открываем Chrome
echo [5/5] Жду запуска сервисов...
timeout /t 12 /nobreak > nul

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --new-window "http://localhost:5173" "http://localhost:5174" "http://localhost:3000/api/docs" "http://localhost:8000/docs"
echo   [+] Chrome открыт

echo.
echo ============================================================
echo   ГОТОВО!
echo   RIS:      http://localhost:5173
echo   SmartQ:   http://localhost:5174
echo   SmartQ API: http://localhost:3000/api/docs
echo   RIS API:  http://localhost:8000/docs
echo.
echo   Нажми любую клавишу — ОСТАНОВИТЬ всё
echo ============================================================
pause > nul

echo Остановка...
taskkill /f /im chrome.exe > nul 2>&1
taskkill /f /im Orthanc.exe > nul 2>&1
powershell -NoProfile -Command "
$titles = @('RIS :8000','Queue :8005','SmartQ Backend','SmartQ Frontend','RIS Frontend');
Get-Process | Where-Object { $_.MainWindowTitle -match ($titles -join '|') } | Stop-Process -Force;
$ports = @(8000,8005,5173,5174,3000);
foreach ($p in $ports) {
    $c = Get-NetTCPConnection -LocalPort $p -EA 0;
    if ($c) { Stop-Process -Id $c[0].OwningProcess -Force }
}
Start-Sleep 2
"
echo Всё остановлено.
timeout /t 3 /nobreak > nul
