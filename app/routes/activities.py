from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
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


class StrongPasswordParams(BaseModel):
    """Parâmetros de nível expostos ao cliente (senha fictícia)."""

    min_length: int = 4
    require_uppercase: bool = True
    require_lowercase: bool = True
    require_digit: bool = False
    require_symbol: bool = False
    require_password_confirmation: bool = False
    confirmation_must_match: bool = True
    symbol_class: str = "ascii_punctuation"
    specificity_count: int = Field(
        1,
        ge=1,
        le=3,
        description="Caracteres específicos por camada (R2 letras; R3 dígitos/símbolos).",
    )
    rounds_total: int = Field(
        1,
        ge=1,
        le=10,
        description="Sem valor no JSON de nível = 1 (modo antigo). Use 3 para três rodadas.",
    )
    using_defaults: bool = Field(
        False,
        description="Sem vínculo ativo user_activity_params+activity_params; regras genéricas.",
    )


class RoboticAlgorithmParams(BaseModel):
    """Parâmetros expostos ao cliente — Algoritmo robótico."""

    rounds_total: int = Field(3, ge=1, le=10)
    scenarios: List[Dict[str, Any]] = Field(default_factory=list)
    commands: List[str] = Field(default_factory=list)
    using_defaults: bool = False
    user_level: Optional[int] = Field(
        None,
        ge=1,
        le=10,
        description="Nível atual na atividade (cenários filtrados por scenario_tier <= user_level).",
    )


class SenhaForteValidateBody(BaseModel):
    activity_id: int
    activity_session_id: int
    round: int = Field(1, ge=1, le=10)
    password: str = ""
    password_confirm: Optional[str] = None


@router.get("/senha-forte/params", response_model=StrongPasswordParams)
async def get_senha_forte_params(
    activity_id: Optional[int] = None,
    current_user: Optional[TokenData] = Depends(get_current_user),
):
    default_params = StrongPasswordParams()
    if not activity_id:
        return default_params
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária para parâmetros personalizados desta atividade",
        )
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
                return StrongPasswordParams(
                    min_length=int(params.get("min_length", default_params.min_length)),
                    require_uppercase=bool(
                        params.get(
                            "require_uppercase", default_params.require_uppercase
                        )
                    ),
                    require_lowercase=bool(
                        params.get(
                            "require_lowercase", default_params.require_lowercase
                        )
                    ),
                    require_digit=bool(
                        params.get("require_digit", default_params.require_digit)
                    ),
                    require_symbol=bool(
                        params.get("require_symbol", default_params.require_symbol)
                    ),
                    require_password_confirmation=bool(
                        params.get(
                            "require_password_confirmation",
                            default_params.require_password_confirmation,
                        )
                    ),
                    confirmation_must_match=bool(
                        params.get(
                            "confirmation_must_match",
                            default_params.confirmation_must_match,
                        )
                    ),
                    symbol_class=str(
                        params.get("symbol_class", default_params.symbol_class)
                    ),
                    specificity_count=int(
                        params.get(
                            "specificity_count", default_params.specificity_count
                        )
                    ),
                    rounds_total=int(
                        params.get("rounds_total", default_params.rounds_total)
                    ),
                    using_defaults=False,
                )
    except Exception as e:
        logger.warning(
            "Erro ao buscar parâmetros senha forte: %s. Retornando padrão.", str(e)
        )
    finally:
        if conn:
            conn.close()
    return default_params.model_copy(update={"using_defaults": True})


@router.get("/robotic-algorithm/params", response_model=RoboticAlgorithmParams)
async def get_robotic_algorithm_params(
    activity_id: Optional[int] = None,
    current_user: Optional[TokenData] = Depends(get_current_user),
):
    from app.core.robotic_algorithm import (
        ALLOWED_COMMANDS,
        filter_scenarios_for_level,
        load_default_scenarios_from_disk,
    )

    disk = load_default_scenarios_from_disk()
    default_scenarios = filter_scenarios_for_level(disk, 1) if disk else []
    default_params = RoboticAlgorithmParams(
        rounds_total=3,
        scenarios=default_scenarios,
        commands=list(ALLOWED_COMMANDS),
        using_defaults=True,
        user_level=1,
    )
    if not activity_id:
        return default_params
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária para parâmetros personalizados desta atividade",
        )
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT ap.level_params, ap.level
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
                user_level = int(result.get("level") or 1)
                user_level = max(1, min(10, user_level))
                scenarios = params.get("scenarios")
                if scenarios is None or (
                    isinstance(scenarios, list) and len(scenarios) == 0
                ):
                    scenarios = disk if disk else []
                scenarios = filter_scenarios_for_level(scenarios, user_level)
                cmds = params.get("commands") or default_params.commands
                if not cmds:
                    cmds = list(ALLOWED_COMMANDS)
                return RoboticAlgorithmParams(
                    rounds_total=int(
                        params.get("rounds_total", default_params.rounds_total)
                    ),
                    scenarios=scenarios,
                    commands=cmds,
                    using_defaults=False,
                    user_level=user_level,
                )
    except Exception as e:
        logger.warning(
            "Erro ao buscar parâmetros algoritmo robótico: %s. Retornando padrão.",
            str(e),
        )
    finally:
        if conn:
            conn.close()
    return default_params


@router.post("/senha-forte/validate")
async def post_senha_forte_validate(
    body: SenhaForteValidateBody,
    current_user: TokenData = Depends(get_current_user),
):
    from app.core.strong_password import (
        get_rounds_total,
        validate_password_against_level_params,
        validate_password_for_round,
    )

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
                (current_user.user_id, body.activity_id),
            )
            result = cur.fetchone()
            if not result or not result.get("level_params"):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Não há parâmetros de nível atribuídos a si para esta atividade "
                        "(user_activity_params + activity_params). "
                        "Peça a um professor/administrador para associar um nível em "
                        "«Parâmetros por utilizador» ou execute a reavaliação de níveis em Gerenciar."
                    ),
                )
            lp = result["level_params"]
            if isinstance(lp, str):
                import json as _json

                lp = _json.loads(lp)

            cur.execute(
                """
                SELECT asess.results, asess.activity_id
                FROM activity_sessions asess
                JOIN user_sessions us ON asess.user_session_id = us.user_session_id
                WHERE asess.activity_session_id = %s
                    AND us.user_id = %s
                    AND asess.activity_id = %s
                """,
                (
                    body.activity_session_id,
                    current_user.user_id,
                    body.activity_id,
                ),
            )
            sess_row = cur.fetchone()
            if not sess_row:
                raise HTTPException(
                    status_code=404,
                    detail="Sessão de atividade não encontrada para validação.",
                )
            res = sess_row.get("results") or {}
            if isinstance(res, str):
                import json as _json

                res = _json.loads(res)
            challenge = (res or {}).get("challenge")
            rounds_total = get_rounds_total(lp)

            if rounds_total >= 2:
                if not challenge:
                    raise HTTPException(
                        status_code=400,
                        detail="Crie uma nova sessão desta atividade (desafio em falta).",
                    )
                ok, msg = validate_password_for_round(
                    lp,
                    challenge,
                    body.round,
                    body.password,
                    body.password_confirm,
                )
            else:
                ok, msg = validate_password_against_level_params(
                    lp, body.password, body.password_confirm
                )
    finally:
        if conn:
            conn.close()
    return {"valid": ok, "message": msg}
