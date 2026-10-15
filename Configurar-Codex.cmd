@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Instale Node.js 24 ou superior antes de continuar.
  pause
  exit /b 1
)
call node "%~dp0scripts\Configurar-Codex.mjs"
set "monitorSetupExit=%errorlevel%"
echo.
pause
exit /b %monitorSetupExit%
