@echo off
REM Raiz do repositorio (scripts/legacy/cloud-sql -> sobe 3 niveis)
cd /d "%~dp0..\..\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pg-dump-cloudsql.ps1"
if errorlevel 1 pause
