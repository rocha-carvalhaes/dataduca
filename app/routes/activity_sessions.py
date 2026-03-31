from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import logging
import json
from dotenv import load_dotenv
from app.core.roles import ROLE_ALUNO, is_staff
from app.routes.auth import get_current_user, TokenData
from app.core.session_cache import register_session, complete_session
from app.routes.user_levels import evaluate_user_level

# Carregar variáveis de ambiente
load_dotenv()

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/activity-sessions", tags=["Activity Sessions"])


def get_db_connection():
    """Cria e retorna uma conexão com o banco de dados"""
    try:
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            conn = psycopg2.connect(database_url)
        else:
            conn = psycopg2.connect(
                host=os.getenv("DB_HOST", "localhost"),
                port=os.getenv("DB_PORT", "5432"),
                database=os.getenv("DB_NAME", "dataduca"),
                user=os.getenv("DB_USER", "postgres"),
                password=os.getenv("DB_PASSWORD", "postgres"),
            )
        return conn
    except psycopg2.OperationalError as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao conectar ao banco de dados: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao conectar ao banco: {str(e)}"
        )


# Modelos Pydantic
class ActivitySessionCreate(BaseModel):
    activity_id: int
    results: Optional[dict] = None  # Pode ser None no início


class ActivitySessionUpdate(BaseModel):
    results: dict
    ended_at: Optional[datetime] = None


class ActivitySessionResponse(BaseModel):
    activity_session_id: int
    user_session_id: int
    user_name: str
    activity_id: int
    activity_name: str
    results: dict
    initiated_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.post("/", response_model=ActivitySessionResponse, status_code=201)
async def create_activity_session(  # noqa: C901
    session_data: ActivitySessionCreate,
    current_user: TokenData = Depends(get_current_user),
):
    """Cria uma nova sessão de atividade"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Obter a sessão ativa do usuário
            cur.execute(
                """
                SELECT user_session_id
                FROM user_sessions
                WHERE user_id = %s AND ended_at IS NULL
                ORDER BY initiated_at DESC
                LIMIT 1
            """,
                (current_user.user_id,),
            )
            user_session = cur.fetchone()
            if not user_session:
                raise HTTPException(
                    status_code=404, detail="Nenhuma sessão de usuário ativa encontrada"
                )

            # Verificar se a atividade existe
            cur.execute(
                "SELECT activity_id FROM activities WHERE activity_id = %s",
                (session_data.activity_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Atividade não encontrada")

            # Criar a sessão de atividade com results vazio ou inicial
            initial_results = session_data.results or {}
            cur.execute(
                """
                INSERT INTO activity_sessions (user_session_id, activity_id, results)
                VALUES (%s, %s, %s)
                RETURNING activity_session_id, user_session_id, activity_id, results, initiated_at, ended_at
            """,
                (
                    user_session["user_session_id"],
                    session_data.activity_id,
                    json.dumps(initial_results),
                ),
            )
            new_session = cur.fetchone()

            merged_results = dict(initial_results)
            cur.execute(
                "SELECT activity_type FROM activities WHERE activity_id = %s",
                (session_data.activity_id,),
            )
            at_row = cur.fetchone()
            if at_row and at_row.get("activity_type") == "senha_forte":
                cur.execute(
                    """
                    SELECT ap.level_params
                    FROM user_activity_params uap
                    JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                    WHERE uap.user_id = %s AND ap.activity_id = %s
                        AND uap.active = TRUE AND ap.active = TRUE
                    ORDER BY uap.initiated_at DESC
                    LIMIT 1
                    """,
                    (current_user.user_id, session_data.activity_id),
                )
                lp_row = cur.fetchone()
                if lp_row and lp_row.get("level_params"):
                    lp = lp_row["level_params"]
                    if isinstance(lp, str):
                        lp = json.loads(lp)
                    from app.core.strong_password import (
                        challenge_seed_from_session,
                        generate_senha_forte_challenge,
                        get_rounds_total,
                        is_multi_round,
                    )

                    if is_multi_round(lp):
                        sid = new_session["activity_session_id"]
                        seed = challenge_seed_from_session(sid, current_user.user_id)
                        ch = generate_senha_forte_challenge(lp, seed)
                        merged_results.update(
                            {
                                "senha_forte_version": 2,
                                "current_round": 1,
                                "rounds_total": get_rounds_total(lp),
                                "challenge": ch,
                            }
                        )
                        cur.execute(
                            """
                            UPDATE activity_sessions
                            SET results = %s
                            WHERE activity_session_id = %s
                            """,
                            (json.dumps(merged_results), sid),
                        )
                        new_session = dict(new_session)
                        new_session["results"] = merged_results

            elif at_row and at_row.get("activity_type") == "algoritmo_robotico":
                cur.execute(
                    """
                    SELECT ap.level_params, ap.level
                    FROM user_activity_params uap
                    JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                    WHERE uap.user_id = %s AND ap.activity_id = %s
                        AND uap.active = TRUE AND ap.active = TRUE
                    ORDER BY uap.initiated_at DESC
                    LIMIT 1
                    """,
                    (current_user.user_id, session_data.activity_id),
                )
                lp_row = cur.fetchone()
                lp = {}
                user_level = 1
                if lp_row and lp_row.get("level_params"):
                    lp = lp_row["level_params"]
                    if isinstance(lp, str):
                        lp = json.loads(lp)
                    try:
                        user_level = int(lp_row.get("level") or 1)
                    except (TypeError, ValueError):
                        user_level = 1
                    user_level = max(1, min(10, user_level))
                from app.core.robotic_algorithm import (
                    filter_scenarios_for_level,
                    initial_session_results,
                    load_default_scenarios_from_disk,
                    pick_scenario_index_in_eligible,
                    scenario_seed,
                )

                scenarios = lp.get("scenarios") or []
                if not scenarios:
                    scenarios = load_default_scenarios_from_disk()
                eligible = filter_scenarios_for_level(scenarios, user_level)
                try:
                    rt = int(lp.get("rounds_total", 3))
                except (TypeError, ValueError):
                    rt = 3
                rounds_total = max(1, min(10, rt))
                sid = new_session["activity_session_id"]
                indices = []
                for r in range(rounds_total):
                    seed = scenario_seed(sid, current_user.user_id, r + 1)
                    indices.append(pick_scenario_index_in_eligible(seed, eligible))
                merged_results.update(
                    initial_session_results(rounds_total, scenario_indices=indices)
                )
                cur.execute(
                    """
                    UPDATE activity_sessions
                    SET results = %s
                    WHERE activity_session_id = %s
                    """,
                    (json.dumps(merged_results), sid),
                )
                new_session = dict(new_session)
                new_session["results"] = merged_results

            # Buscar informações adicionais para a resposta
            cur.execute(
                """
                SELECT u.user_name, a.activity_name
                FROM user_sessions us
                JOIN users u ON us.user_id = u.user_id
                JOIN activities a ON a.activity_id = %s
                WHERE us.user_session_id = %s
            """,
                (session_data.activity_id, user_session["user_session_id"]),
            )
            info = cur.fetchone()

            conn.commit()

            # Registrar sessão no cache (SEM consultar o banco!)
            register_session(
                new_session["activity_session_id"],
                current_user.user_id,  # Já temos do token
                session_data.activity_id,  # Já temos do body
            )

            result = dict(new_session)
            result["user_name"] = info["user_name"]
            result["activity_name"] = info["activity_name"]
            return result
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao criar sessão de atividade: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao criar sessão de atividade: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.put("/{activity_session_id}", response_model=ActivitySessionResponse)
async def update_activity_session(  # noqa: C901
    activity_session_id: int,
    session_data: ActivitySessionUpdate,
    current_user: TokenData = Depends(get_current_user),
):
    """Atualiza uma sessão de atividade com os resultados finais"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se a sessão existe e pertence ao usuário
            # Também verificar se já estava finalizada antes
            cur.execute(
                """
                SELECT asess.activity_session_id, asess.user_session_id, asess.ended_at,
                       asess.activity_id, asess.results
                FROM activity_sessions asess
                JOIN user_sessions us ON asess.user_session_id = us.user_session_id
                WHERE asess.activity_session_id = %s AND us.user_id = %s
            """,
                (activity_session_id, current_user.user_id),
            )
            session = cur.fetchone()
            if not session:
                raise HTTPException(
                    status_code=404, detail="Sessão de atividade não encontrada"
                )

            # Verificar se a sessão já estava finalizada antes
            was_already_finalized = session.get("ended_at") is not None

            activity_id = session["activity_id"]
            results_to_save = (
                dict(session_data.results)
                if isinstance(session_data.results, dict)
                else {}
            )

            cur.execute(
                "SELECT activity_type FROM activities WHERE activity_id = %s",
                (activity_id,),
            )
            at_row = cur.fetchone()
            activity_type = (at_row or {}).get("activity_type")

            if activity_type == "senha_forte":
                cur.execute(
                    """
                    SELECT ap.level_params
                    FROM user_activity_params uap
                    JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                    WHERE uap.user_id = %s AND ap.activity_id = %s
                        AND uap.active = TRUE AND ap.active = TRUE
                    ORDER BY uap.initiated_at DESC
                    LIMIT 1
                    """,
                    (current_user.user_id, activity_id),
                )
                lp_row = cur.fetchone()
                if not lp_row or not lp_row.get("level_params"):
                    raise HTTPException(
                        status_code=400,
                        detail="Parâmetros de nível não encontrados para esta atividade.",
                    )
                lp = lp_row["level_params"]
                if isinstance(lp, str):
                    lp = json.loads(lp)
                from app.core.strong_password import finalize_senha_forte_results

                stored = session.get("results") or {}
                if isinstance(stored, str):
                    stored = json.loads(stored)
                ch_server = (stored or {}).get("challenge")
                if ch_server:
                    results_to_save["challenge"] = ch_server

                results_to_save = finalize_senha_forte_results(
                    results_to_save, lp, challenge=ch_server
                )

            # Atualizar resultados; só alterar ended_at quando o cliente envia data
            # (atualizações intermédias sem ended_at preservam a sessão aberta).
            update_query = "UPDATE activity_sessions SET results = %s"
            update_values = [json.dumps(results_to_save)]

            if session_data.ended_at is not None:
                update_query += ", ended_at = %s"
                update_values.append(session_data.ended_at)

            update_query += (
                " WHERE activity_session_id = %s "
                "RETURNING activity_session_id, user_session_id, "
                "activity_id, results, initiated_at, ended_at"
            )
            update_values.append(activity_session_id)

            cur.execute(update_query, update_values)
            updated_session = cur.fetchone()

            # Verificar se a sessão foi finalizada AGORA (não estava antes)
            # Se ended_at estava None antes e agora não está None, a sessão foi finalizada
            session_was_just_finalized = (
                not was_already_finalized
                and updated_session.get("ended_at") is not None
            )

            if session_was_just_finalized:
                # Buscar do cache (SEM consultar o banco!)
                session_info = complete_session(activity_session_id)

                if session_info:
                    user_id, activity_id, new_count = session_info
                    logger.info(
                        f"Sessão completada via cache: user_id={user_id}, "
                        f"activity_id={activity_id}, total_completadas={new_count}"
                    )

                    # Se o total de sessões completadas for múltiplo de 3, disparar avaliação
                    if new_count > 0 and new_count % 3 == 0:
                        logger.info(
                            f"Usuário {user_id} completou {new_count} sessões da atividade {activity_id} "
                            f"(múltiplo de 3). Disparando avaliação de nível automaticamente."
                        )
                        try:
                            # Chamar avaliação de nível de forma assíncrona
                            # Usar o current_user para autenticação
                            await evaluate_user_level(
                                user_id=user_id,
                                activity_id=activity_id,
                                current_user=current_user,
                            )
                            logger.info(
                                f"Avaliação de nível concluída para user_id={user_id}, "
                                f"activity_id={activity_id}"
                            )
                        except Exception as e:
                            # Não falhar a atualização da sessão se a avaliação der erro
                            logger.error(
                                f"Erro ao avaliar nível automaticamente: {str(e)}",
                                exc_info=True,
                            )
                else:
                    logger.warning(
                        f"Sessão {activity_session_id} não encontrada no cache. "
                        "Cache pode ter expirado ou sessão não foi registrada."
                    )

            # Buscar informações adicionais para a resposta
            cur.execute(
                """
                SELECT u.user_name, a.activity_name
                FROM activity_sessions asess
                JOIN user_sessions us ON asess.user_session_id = us.user_session_id
                JOIN users u ON us.user_id = u.user_id
                JOIN activities a ON asess.activity_id = a.activity_id
                WHERE asess.activity_session_id = %s
            """,
                (activity_session_id,),
            )
            info = cur.fetchone()

            conn.commit()
            result = dict(updated_session)
            result["user_name"] = info["user_name"]
            result["activity_name"] = info["activity_name"]
            return result
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao atualizar sessão de atividade: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao atualizar sessão de atividade: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.get("/{activity_session_id}", response_model=ActivitySessionResponse)
async def get_activity_session(
    activity_session_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Retorna uma sessão de atividade específica.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    asess.activity_session_id,
                    asess.user_session_id,
                    us.user_id,
                    asess.activity_id,
                    u.user_name,
                    a.activity_name,
                    asess.results,
                    asess.initiated_at,
                    asess.ended_at
                FROM activity_sessions asess
                JOIN user_sessions us ON asess.user_session_id = us.user_session_id
                JOIN users u ON us.user_id = u.user_id
                JOIN activities a ON asess.activity_id = a.activity_id
                WHERE asess.activity_session_id = %s
            """,
                (activity_session_id,),
            )
            session = cur.fetchone()
            if not session:
                raise HTTPException(
                    status_code=404, detail="Sessão de atividade não encontrada"
                )
            if (
                not is_staff(current_user.user_type)
                and session["user_id"] != current_user.user_id
            ):
                raise HTTPException(status_code=403, detail="Permissão negada")
            out = dict(session)
            out.pop("user_id", None)
            return out
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar sessão de atividade: {str(e)}", exc_info=True)
        error_msg = f"Erro ao buscar sessão de atividade: {str(e)}"
        raise HTTPException(status_code=500, detail=error_msg)
    finally:
        if conn:
            conn.close()


@router.get("/", response_model=List[ActivitySessionResponse])
async def list_activity_sessions(current_user: TokenData = Depends(get_current_user)):
    """Lista sessões de atividade: aluno só as próprias; staff todas."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            base = """
                SELECT
                    asess.activity_session_id,
                    asess.user_session_id,
                    u.user_name,
                    asess.activity_id,
                    a.activity_name,
                    asess.results,
                    asess.initiated_at,
                    asess.ended_at
                FROM activity_sessions asess
                JOIN user_sessions us ON asess.user_session_id = us.user_session_id
                JOIN users u ON us.user_id = u.user_id
                JOIN activities a ON asess.activity_id = a.activity_id
            """
            if is_staff(current_user.user_type):
                cur.execute(base + " ORDER BY asess.initiated_at DESC")
            elif current_user.user_type == ROLE_ALUNO:
                cur.execute(
                    base + " WHERE us.user_id = %s ORDER BY asess.initiated_at DESC",
                    (current_user.user_id,),
                )
            else:
                raise HTTPException(
                    status_code=403, detail="Papel de usuário não suportado"
                )
            sessions = cur.fetchall()
            return [dict(session) for session in sessions]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar sessões de atividades: {str(e)}", exc_info=True)
        error_msg = f"Erro ao listar sessões de atividades: {str(e)}"
        raise HTTPException(status_code=500, detail=error_msg)
    finally:
        if conn:
            conn.close()
