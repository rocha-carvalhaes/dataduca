import logging

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

logger = logging.getLogger(__name__)

# Qualquer deploy em *.vercel.app (produção ou preview), além da lista explícita em CORS_ORIGINS.
_VERCEL_APP_ORIGIN_REGEX = r"https://[a-zA-Z0-9][a-zA-Z0-9.-]*\.vercel\.app"


def _normalize_origin(origin: str) -> str:
    """Origin sem barra final; remove aspas que às vezes vêm coladas na variável do Railway."""
    o = origin.strip().rstrip("/")
    if len(o) >= 2 and o[0] == o[-1] and o[0] in "\"'":
        o = o[1:-1].strip().rstrip("/")
    return o


def _resolve_cors_origins():
    raw = (settings.CORS_ORIGINS or "").strip()
    from_env = [_normalize_origin(o) for o in raw.split(",") if o.strip()]
    dev_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

    if settings.DEBUG:
        seen: set[str] = set()
        merged: list[str] = []
        for o in dev_origins + from_env:
            if o and o not in seen:
                seen.add(o)
                merged.append(o)
        return merged if merged else dev_origins

    if from_env:
        return from_env
    return dev_origins


_cors_allow_origins = _resolve_cors_origins()

# Cria a instância da aplicação FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

# CORS: Bearer sem cookies → allow_credentials=False. Lista explícita + regex Vercel (previews).
# CORS_ORIGINS no Railway: sem aspas, sem barra no final (ex.: https://dataduca.vercel.app).
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins,
    allow_origin_regex=_VERCEL_APP_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _log_cors_on_startup():
    logger.info(
        "CORS allow_origins=%s allow_origin_regex=%s",
        _cors_allow_origins,
        _VERCEL_APP_ORIGIN_REGEX,
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
