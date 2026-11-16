@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Instala Node.js 24 LTS desde https://nodejs.org y volve a ejecutar. & pause & exit /b 1)
call npm ci
if errorlevel 1 goto :error
call npm run init
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
echo.
echo Instalacion terminada. Conserva el codigo mostrado arriba.
echo Ejecuta INICIAR-WINDOWS.bat y abri http://localhost:3001
pause
exit /b 0
:error
echo No se completo la instalacion. Revisa el error anterior.
pause
exit /b 1
