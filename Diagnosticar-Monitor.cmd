@echo off
setlocal
cd /d "%~dp0"
call node "%~dp0scripts\Diagnosticar-Monitor.mjs"
pause
