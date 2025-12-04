from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import logging
from dotenv import load_dotenv

from app.routes.auth import get_current_user, TokenData, get_db_connection

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/activities", tags=["Activities"])


class TypingActivityParams(BaseModel):
    characters: List[str]
    total_bubbles: int
    speed: float  # pixels per frame


@router.get("/typing/params", response_model=TypingActivityParams)
async def get_typing_params(
    activity_id: Optional[int] = None,
    current_user: Optional[TokenData] = Depends(get_current_user),
):
    """
    Retorna parâmentros para a atividade de digitação.
    Se o usuário tiver parâmetros personalizados para a atividade,
    retorna esses parâmetros. Caso contrário, retorna parâmetros padrão.
    """
    # Parâmetros padrão
    default_params = TypingActivityParams(
        characters=["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        total_bubbles=15,
        speed=1.5,  # Slow speed
    )

    # Se não houver activity_id, retorna padrão
    if not activity_id:
        return default_params

    # Tentar buscar parâmetros personalizados do usuário
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT params
                FROM user_activity_params
                WHERE user_id = %s
                    AND activity_id = %s
                    AND active = TRUE
                ORDER BY initiated_at DESC
                LIMIT 1
            """,
                (current_user.user_id, activity_id),
            )
            result = cur.fetchone()

            if result and result["params"]:
                params = result["params"]
                # Validar e retornar parâmetros personalizados
                return TypingActivityParams(
                    characters=params.get("characters", default_params.characters),
                    total_bubbles=params.get(
                        "total_bubbles", default_params.total_bubbles
                    ),
                    speed=params.get("speed", default_params.speed),
                )
    except Exception as e:
        logger.warning(
            f"Erro ao buscar parâmetros personalizados: {str(e)}. "
            "Retornando parâmetros padrão."
        )
    finally:
        if conn:
            conn.close()

    # Retornar parâmetros padrão se não encontrar personalizados
    return default_params
