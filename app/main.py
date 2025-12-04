from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import (
    health_check,
    activities,
    users,
    auth,
    user_sessions,
    activity_sessions,
    activities_manage,
    documents,
)
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
    # Em produção, usar origem específica
    allow_origins=["*"] if settings.DEBUG else ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclui os routers
app.include_router(health_check.router)
app.include_router(auth.router)
app.include_router(activities.router)
app.include_router(activities_manage.router)
app.include_router(users.router)
app.include_router(user_sessions.router)
app.include_router(activity_sessions.router)
app.include_router(documents.router)

# Define o endpoint raiz
# Esse endpoint é usado para verificar se o servidor está funcionando


@app.get("/", tags=["Root"])
async def read_root():
    return {
        "message": f"🚀 {settings.APP_NAME} está rodando!",
        "docs": "Acesse /docs para ver a documentação interativa.",
    }
