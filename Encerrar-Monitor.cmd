@echo off
setlocal
cd /d "%~dp0"
call node "%~dp0scripts\Encerrar-Monitor.mjs"
if errorlevel 1 pause
