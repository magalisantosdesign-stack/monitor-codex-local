@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Instale Node.js 24 ou superior e abra este arquivo novamente.
  pause
  exit /b 1
)
call node "%~dp0scripts\Abrir-Monitor.mjs"
if errorlevel 1 (
  echo.
  echo Nao foi possivel concluir a abertura. Confira a mensagem acima.
  echo Execute Diagnosticar-Monitor.cmd se precisar de mais detalhes.
  pause
  exit /b 1
)
