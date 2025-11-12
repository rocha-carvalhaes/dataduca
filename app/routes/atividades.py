from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/atividades", tags=["Atividades"])


class AtividadeDigitacaoParams(BaseModel):
    caracteres: List[str]
    total_bolhas: int
    velocidade: float  # pixels por frame


@router.get("/digitacao/params", response_model=AtividadeDigitacaoParams)
async def obter_params_digitacao():
    """
    Retorna os parâmetros para a atividade de digitação.
    Por padrão, retorna letras da fila superior do teclado (q,w,e,r,t,y,u,i,o,p),
    10 bolhas e velocidade devagar (1.5 pixels por frame).
    """
    return AtividadeDigitacaoParams(
        caracteres=["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        total_bolhas=15,
        velocidade=1.5  # Velocidade devagar
    )

