@echo off
title Nexo - Panel Administrativo
cd /d "%~dp0"

if not exist .env (
    echo [ERROR] No existe el archivo .env. Ejecuta INSTALAR-WINDOWS.bat primero.
    pause
    exit /b 1
)

:: Verificar si el servidor ya esta activo en el puerto 3001
powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue; if ($conn) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 (
    echo El servidor ya esta en ejecucion. Abriendo navegador...
    start "" http://localhost:3001
    exit /b 0
)

echo Iniciando Nexo en http://localhost:3001 ...
echo Para detener el servidor, cerra esta ventana o presiona Ctrl+C.
echo.

:: Abrir el navegador tras 1.5 segundos cuando el servidor este listo
start "" powershell -NoProfile -Command "Start-Sleep -Milliseconds 1500; Start-Process 'http://localhost:3001'"

call npm start
pause
