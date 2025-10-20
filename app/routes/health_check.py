from fastapi import APIRouter

# Cria o router para o endpoint de health check
router = APIRouter()

# Define o endpoint de health check
# Esse endpoint é usado para verificar se o servidor está funcionando
@router.get("/health", tags=["Health Check"])
async def health_check():
    return {"status": "ok"}