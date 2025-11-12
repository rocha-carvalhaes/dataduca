@echo off
echo Iniciando backend Dataduca...
cd /d %~dp0
if exist env\Scripts\activate.bat (
    call env\Scripts\activate.bat
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) else (
    echo Ambiente virtual nao encontrado. Execute: python -m venv env
    pause
)

