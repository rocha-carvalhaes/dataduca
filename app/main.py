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
    user_activity_params,
    activity_params,
    user_levels,
    manage,
)
from app.core.config import settings


def _resolve_cors_origins():
    if settings.DEBUG:
        return ["*"]
    raw = (settings.CORS_ORIGINS or "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return ["http://localhost:5173"]


# Cria a instância da aplicação FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

# CORS: em produção defina CORS_ORIGINS (ex.: URL do front)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_origins(),
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
app.include_router(activity_params.router)
app.include_router(user_activity_params.router)
app.include_router(user_levels.router)
app.include_router(manage.router)

# Define o endpoint raiz
# Esse endpoint é usado para verificar se o servidor está funcionando


@app.get("/", tags=["Root"])
async def read_root():
    return {
        "message": f"🚀 {settings.APP_NAME} está rodando!",
        "docs": "Acesse /docs para ver a documentação interativa.",
    }
