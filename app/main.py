from fastapi import FastAPI
from app.routes import health_check
from app.core.config import settings

# Cria a instância da aplicação FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

# Inclui o router de health check
app.include_router(health_check.router)

# Define o endpoint raiz
# Esse endpoint é usado para verificar se o servidor está funcionando
@app.get("/", tags=["Root"])
async def read_root():
    return {
        "message": f"🚀 {settings.APP_NAME} está rodando!",
        "docs": "Acesse /docs para ver a documentação interativa."
    }