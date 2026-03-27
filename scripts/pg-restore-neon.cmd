@echo off
REM Executa o restore no Neon sem alterar a politica de execucao do PowerShell.
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pg-restore-neon.ps1"
if errorlevel 1 pause
