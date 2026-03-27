# Imagem para produção no Railway (ou qualquer host que defina PORT).
# https://docs.railway.app/builds/dockerfiles
FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Railway injeta PORT em runtime; localmente use: docker run -e PORT=8000 -p 8000:8000 ...
EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
