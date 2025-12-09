"""
Endpoints para gerenciamento e atualização de níveis de usuários.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from psycopg2.extras import RealDictCursor
import logging
import json

from app.routes.auth import get_current_user, TokenData, get_db_connection
from app.core.level_evaluator import LevelEvaluator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user-levels", tags=["User Levels"])


class LevelUpdateResponse(BaseModel):
    user_id: int
    activity_id: int
    updated: bool
    message: str
    old_level: Optional[int] = None
    new_level: Optional[int] = None
    action: Optional[str] = None
    reason: Optional[str] = None


@router.post("/evaluate/{user_id}/{activity_id}", response_model=LevelUpdateResponse)
async def evaluate_user_level(  # noqa: C901
    user_id: int,
    activity_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Avalia e atualiza o nível de um usuário para uma atividade específica.
    Busca as últimas N sessões e avalia conforme os parâmetros configurados.
    """
    conn = None
    try:
        # Verificar permissões (apenas admin/professor ou o próprio usuário)
        if (
            current_user.user_type not in ["administrador", "professor"]
            and current_user.user_id != user_id
        ):
            raise HTTPException(403, "Você não tem permissão para avaliar este usuário")

        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Buscar nível atual do usuário e data de início do nível
            cur.execute(
                """
                SELECT
                    uap.user_activity_params_id,
                    uap.initiated_at,
                    ap.level,
                    ap.activity_param_id,
                    ap.level_params,
                    ap.level_up_params,
                    ap.level_down_params,
                    a.activity_type
                FROM user_activity_params uap
                JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                JOIN activities a ON ap.activity_id = a.activity_id
                WHERE uap.user_id = %s
                    AND ap.activity_id = %s
                    AND uap.active = TRUE
                    AND ap.active = TRUE
                ORDER BY uap.initiated_at DESC
                LIMIT 1
            """,
                (user_id, activity_id),
            )

            current_level_data = cur.fetchone()
            if not current_level_data:
                raise HTTPException(
                    404,
                    f"Nível não encontrado para usuário {user_id} e atividade {activity_id}. "
                    "Configure activity_params e atribua um nível ao usuário primeiro.",
                )

            current_level = current_level_data["level"]
            activity_type = current_level_data["activity_type"]
            level_start_date = current_level_data["initiated_at"]

            if level_start_date:
                logger.info(f"Nível atual iniciado em: {level_start_date}")

            # Obter parâmetros de avaliação das colunas separadas
            def parse_json_field(field_value):
                """Converte campo JSONB para dict, lidando com diferentes formatos."""
                if field_value is None:
                    return {}
                if isinstance(field_value, dict):
                    return field_value
                if isinstance(field_value, str):
                    return json.loads(field_value) if field_value else {}
                return {}

            level_up_params = parse_json_field(current_level_data["level_up_params"])
            level_down_params = parse_json_field(
                current_level_data["level_down_params"]
            )

            # Log para debug
            logger.info(
                f"Avaliando nível: user_id={user_id}, activity_id={activity_id}, "
                f"current_level={current_level}, activity_type={activity_type}"
            )
            logger.info(
                f"level_up_params: {level_up_params}, level_down_params: {level_down_params}"
            )

            # Determinar quantidade de sessões a buscar (maior valor entre up e down)
            games_count = max(
                level_up_params.get("games_count", 10),
                level_down_params.get("games_count", 10),
            )

            # Buscar últimas N sessões (apenas as jogadas desde o início do nível atual)
            if level_start_date:
                logger.info(
                    f"Filtrando sessões desde {level_start_date} (início do nível atual)"
                )

            recent_sessions = LevelEvaluator.get_recent_sessions(
                user_id,
                activity_id,
                limit=games_count,
                min_date=level_start_date,
            )

            logger.info(
                f"Encontradas {len(recent_sessions)} sessões recentes para avaliação"
            )

            if not recent_sessions:
                return LevelUpdateResponse(
                    user_id=user_id,
                    activity_id=activity_id,
                    updated=False,
                    message="Nenhuma sessão anterior encontrada para avaliação",
                    old_level=current_level,
                )

            # Avaliar progressão
            evaluation = None
            if activity_type == "digitacao":
                evaluation = LevelEvaluator.evaluate_typing_activity(
                    recent_sessions, level_up_params, level_down_params
                )
                logger.info(f"Resultado avaliação digitação: {evaluation}")
            elif activity_type in ["desembaralhar_frases", "desemble_phrases"]:
                evaluation = LevelEvaluator.evaluate_unscramble_phrases(
                    recent_sessions, level_up_params, level_down_params
                )
                logger.info(f"Resultado avaliação desembaralhar: {evaluation}")
            else:
                logger.warning(f"Tipo de atividade '{activity_type}' não suportado")
                return LevelUpdateResponse(
                    user_id=user_id,
                    activity_id=activity_id,
                    updated=False,
                    message=f"Tipo de atividade '{activity_type}' não suportado",
                    old_level=current_level,
                )

            if evaluation:
                # Determinar novo nível
                if evaluation["action"] == "level_up":
                    new_level = current_level + 1
                else:
                    new_level = max(1, current_level - 1)

                # Buscar activity_param_id do novo nível
                cur.execute(
                    """
                    SELECT activity_param_id
                    FROM activity_params
                    WHERE activity_id = %s AND level = %s AND active = TRUE
                    ORDER BY created_at DESC
                    LIMIT 1
                """,
                    (activity_id, new_level),
                )

                new_level_data = cur.fetchone()
                if not new_level_data:
                    return LevelUpdateResponse(
                        user_id=user_id,
                        activity_id=activity_id,
                        updated=False,
                        message=f"Nível {new_level} não configurado para esta atividade",
                        old_level=current_level,
                    )

                # Inativar nível anterior (SCD Tipo 2)
                cur.execute(
                    """
                    UPDATE user_activity_params
                    SET active = FALSE, ended_at = NOW()
                    WHERE user_id = %s
                        AND activity_param_id IN (
                            SELECT activity_param_id
                            FROM activity_params
                            WHERE activity_id = %s
                        )
                        AND active = TRUE
                """,
                    (user_id, activity_id),
                )

                # Criar novo registro com novo nível
                cur.execute(
                    """
                    INSERT INTO user_activity_params
                    (activity_param_id, user_id, active)
                    VALUES (%s, %s, TRUE)
                    RETURNING user_activity_params_id
                """,
                    (new_level_data["activity_param_id"], user_id),
                )

                conn.commit()

                action_msg = "subiu" if evaluation["action"] == "level_up" else "desceu"
                return LevelUpdateResponse(
                    user_id=user_id,
                    activity_id=activity_id,
                    updated=True,
                    message=f"Nível {action_msg} de {current_level} para {new_level}",
                    old_level=current_level,
                    new_level=new_level,
                    action=evaluation["action"],
                    reason=evaluation.get("reason"),
                )

            return LevelUpdateResponse(
                user_id=user_id,
                activity_id=activity_id,
                updated=False,
                message="Nível mantido - critérios não atendidos",
                old_level=current_level,
            )

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao avaliar nível: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Erro ao avaliar nível: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/evaluate-all/{user_id}")
async def evaluate_all_user_levels(
    user_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Avalia e atualiza todos os níveis de um usuário.
    """
    # Verificar permissões
    if (
        current_user.user_type not in ["administrador", "professor"]
        and current_user.user_id != user_id
    ):
        raise HTTPException(403, "Você não tem permissão para avaliar este usuário")

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Buscar todas as atividades do usuário
            cur.execute(
                """
                SELECT DISTINCT ap.activity_id
                FROM user_activity_params uap
                JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                WHERE uap.user_id = %s AND uap.active = TRUE
            """,
                (user_id,),
            )
            activities = cur.fetchall()

            results = []
            for activity in activities:
                activity_id = activity["activity_id"]
                try:
                    # Chamar avaliação individual
                    result = await evaluate_user_level(
                        user_id, activity_id, current_user
                    )
                    results.append(result.dict())
                except Exception as e:
                    logger.error(
                        f"Erro ao avaliar atividade {activity_id}: {str(e)}",
                        exc_info=True,
                    )
                    results.append(
                        {
                            "user_id": user_id,
                            "activity_id": activity_id,
                            "updated": False,
                            "message": f"Erro: {str(e)}",
                        }
                    )

            return {"user_id": user_id, "results": results}

    except Exception as e:
        logger.error(f"Erro ao avaliar todos os níveis: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Erro ao avaliar níveis: {str(e)}")
    finally:
        if conn:
            conn.close()
