@echo off
cd /d "%~dp0"
if not exist .env (echo Primero ejecuta INSTALAR-WINDOWS.bat. & pause & exit /b 1)
echo Panel local: http://localhost:3001
echo Para detenerlo: Ctrl+C. Cerrar esta ventana detiene la instancia local.
call npm start
pause
