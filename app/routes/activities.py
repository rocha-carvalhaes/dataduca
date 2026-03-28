from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from psycopg2.extras import RealDictCursor
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


class UnscramblePhrasesParams(BaseModel):
    phrases: List[str]  # Lista de frases disponíveis
    phrases_per_session: int  # Quantidade de frases por sessão


class WritingActivityParams(BaseModel):
    phrases: List[str]  # Lista de frases disponíveis
    phrases_per_session: int  # Quantidade de frases por sessão


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

    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária para parâmetros personalizados desta atividade",
        )

    # Tentar buscar parâmetros personalizados do usuário
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT ap.level_params
                FROM user_activity_params uap
                JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                WHERE uap.user_id = %s
                    AND ap.activity_id = %s
                    AND uap.active = TRUE
                    AND ap.active = TRUE
                ORDER BY uap.initiated_at DESC
                LIMIT 1
            """,
                (current_user.user_id, activity_id),
            )
            result = cur.fetchone()

            if result and result["level_params"]:
                params = result["level_params"]
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


@router.get("/unscramble-phrases/params", response_model=UnscramblePhrasesParams)
async def get_unscramble_phrases_params(
    activity_id: Optional[int] = None,
    current_user: Optional[TokenData] = Depends(get_current_user),
):
    """
    Retorna parâmetros para a atividade de desembaralhar frases.
    Se o usuário tiver parâmetros personalizados para a atividade,
    retorna esses parâmetros. Caso contrário, retorna parâmetros padrão.
    """
    # Parâmetros padrão
    default_params = UnscramblePhrasesParams(
        phrases=[
            "O GATO DORME",
            "A MENINA CORRE",
            "O SOL BRILHA",
            "A BOLA ROLA",
            "O PÁSSARO VOA",
            "A FLOR CRESCE",
            "O CÃO LATE",
            "A CHUVA CAI",
            "O PEIXE NADA",
            "A CRIANÇA RI",
            "O VENTO SOPRA",
            "A VACA MUJE",
            "O SAPO PULA",
            "A FOLHA CAI",
            "O CARRO ANDA",
        ],
        phrases_per_session=5,
    )

    # Se não houver activity_id, retorna padrão
    if not activity_id:
        return default_params

    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária para parâmetros personalizados desta atividade",
        )

    # Tentar buscar parâmetros personalizados do usuário
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT ap.level_params
                FROM user_activity_params uap
                JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                WHERE uap.user_id = %s
                    AND ap.activity_id = %s
                    AND uap.active = TRUE
                    AND ap.active = TRUE
                ORDER BY uap.initiated_at DESC
                LIMIT 1
            """,
                (current_user.user_id, activity_id),
            )
            result = cur.fetchone()

            if result and result["level_params"]:
                params = result["level_params"]
                # Validar e retornar parâmetros personalizados
                return UnscramblePhrasesParams(
                    phrases=params.get("phrases", default_params.phrases),
                    phrases_per_session=params.get(
                        "phrases_per_session", default_params.phrases_per_session
                    ),
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


@router.get("/writing/params", response_model=WritingActivityParams)
async def get_writing_params(
    activity_id: Optional[int] = None,
    current_user: Optional[TokenData] = Depends(get_current_user),
):
    """
    Retorna parâmetros para a atividade de escrita.
    Se o usuário tiver parâmetros personalizados para a atividade,
    retorna esses parâmetros. Caso contrário, retorna parâmetros padrão.
    """
    default_params = WritingActivityParams(
        phrases=[
            "Sol",
            "Lua",
            "Mar",
            "Rio",
            "Paz",
            "Luz",
            "Voz",
            "Dor",
            "Mel",
            "Lar",
        ],
        phrases_per_session=3,
    )

    # Se não houver activity_id, retorna padrão
    if not activity_id:
        return default_params

    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária para parâmetros personalizados desta atividade",
        )

    # Tentar buscar parâmetros personalizados do usuário
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT ap.level_params
                FROM user_activity_params uap
                JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                WHERE uap.user_id = %s
                    AND ap.activity_id = %s
                    AND uap.active = TRUE
                    AND ap.active = TRUE
                ORDER BY uap.initiated_at DESC
                LIMIT 1
            """,
                (current_user.user_id, activity_id),
            )
            result = cur.fetchone()

            if result and result["level_params"]:
                params = result["level_params"]
                # Validar e retornar parâmetros personalizados
                return WritingActivityParams(
                    phrases=params.get("phrases", default_params.phrases),
                    phrases_per_session=params.get(
                        "phrases_per_session",
                        default_params.phrases_per_session,
                    ),
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
