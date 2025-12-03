from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import health_check, atividades, usuarios
from app.core.config import settings

# Cria a instância da aplicação FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

# Configura CORS para permitir requisições do frontend
# Em desenvolvimento, permite qualquer porta do localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else ["http://localhost:5173"],  # Em produção, usar origem específica
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclui os routers
app.include_router(health_check.router)
app.include_router(atividades.router)
app.include_router(usuarios.router)

# Define o endpoint raiz
# Esse endpoint é usado para verificar se o servidor está funcionando
@app.get("/", tags=["Root"])
async def read_root():
    return {
        "message": f"🚀 {settings.APP_NAME} está rodando!",
        "docs": "Acesse /docs para ver a documentação interativa."
    }