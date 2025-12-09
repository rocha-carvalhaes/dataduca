from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from psycopg2.extras import RealDictCursor
import json
import logging
from datetime import datetime
from dotenv import load_dotenv

from app.routes.auth import get_current_user, TokenData, get_db_connection

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/activity-params", tags=["Activity Params"])


def is_admin_or_professor(user_type: str) -> bool:
    """Verifica se o usuário tem permissões administrativas"""
    return user_type in ["professor", "administrador"]


class ActivityParamsCreate(BaseModel):
    activity_id: int
    level: int
    level_params: Dict[str, Any]  # JSONB com os parâmetros do nível
    level_down_params: Optional[Dict[str, Any]] = (
        None  # Parâmetros para descer de nível
    )
    level_up_params: Optional[Dict[str, Any]] = None  # Parâmetros para subir de nível


class ActivityParamsResponse(BaseModel):
    activity_param_id: int
    activity_id: int
    level: int
    level_params: Dict[str, Any]
    level_down_params: Optional[Dict[str, Any]] = None
    level_up_params: Optional[Dict[str, Any]] = None
    created_at: datetime
    ended_at: Optional[datetime] = None
    active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ActivityParamsResponse])
async def list_activity_params(
    activity_id: Optional[int] = None,
    active_only: bool = True,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Lista parâmetros de níveis de atividades.
    Por padrão, retorna apenas parâmetros ativos.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT
                    activity_param_id,
                    activity_id,
                    level,
                    level_params,
                    level_down_params,
                    level_up_params,
                    created_at,
                    ended_at,
                    active
                FROM activity_params
                WHERE 1=1
            """
            params = []

            if activity_id:
                query += " AND activity_id = %s"
                params.append(activity_id)

            if active_only:
                query += " AND active = TRUE"

            query += " ORDER BY activity_id, level, created_at DESC"

            cur.execute(query, params)
            results = cur.fetchall()
            return [dict(row) for row in results]
    except Exception as e:
        logger.error(f"Erro ao listar parâmetros: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao listar parâmetros: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.get("/{activity_param_id}", response_model=ActivityParamsResponse)
async def get_activity_params(
    activity_param_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Obtém um registro específico de parâmetros por ID.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    activity_param_id,
                    activity_id,
                    level,
                    level_params,
                    level_down_params,
                    level_up_params,
                    created_at,
                    ended_at,
                    active
                FROM activity_params
                WHERE activity_param_id = %s
            """,
                (activity_param_id,),
            )
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=404, detail="Parâmetros não encontrados"
                )
            return dict(result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter parâmetros: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao obter parâmetros: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.post("/", response_model=ActivityParamsResponse, status_code=201)
async def create_activity_params(
    params_data: ActivityParamsCreate,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Cria novos parâmetros de nível para uma atividade.
    Seguindo SCD Tipo 2: inativa parâmetros anteriores do mesmo nível
    e cria um novo registro.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se a atividade existe
            cur.execute(
                "SELECT activity_id FROM activities WHERE activity_id = %s",
                (params_data.activity_id,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Atividade não encontrada")

            # Inativar parâmetros anteriores do mesmo nível (SCD Tipo 2)
            cur.execute(
                """
                UPDATE activity_params
                SET active = FALSE, ended_at = NOW()
                WHERE activity_id = %s
                    AND level = %s
                    AND active = TRUE
            """,
                (params_data.activity_id, params_data.level),
            )

            # Criar novo registro com parâmetros ativos
            cur.execute(
                """
                INSERT INTO activity_params (
                    activity_id,
                    level,
                    level_params,
                    level_down_params,
                    level_up_params,
                    active
                )
                VALUES (%s, %s, %s, %s, %s, TRUE)
                RETURNING
                    activity_param_id,
                    activity_id,
                    level,
                    level_params,
                    level_down_params,
                    level_up_params,
                    created_at,
                    ended_at,
                    active
            """,
                (
                    params_data.activity_id,
                    params_data.level,
                    json.dumps(params_data.level_params),
                    (
                        json.dumps(params_data.level_down_params)
                        if params_data.level_down_params
                        else None
                    ),
                    (
                        json.dumps(params_data.level_up_params)
                        if params_data.level_up_params
                        else None
                    ),
                ),
            )
            new_params = cur.fetchone()

            conn.commit()
            return dict(new_params)
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao criar parâmetros: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao criar parâmetros: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.delete("/{activity_param_id}", status_code=204)
async def delete_activity_params(
    activity_param_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Deleta (inativa) parâmetros de nível de atividade.
    Apenas administradores e professores podem deletar.
    """
    conn = None
    try:
        # Verificar permissões
        if not is_admin_or_professor(current_user.user_type):
            raise HTTPException(
                status_code=403,
                detail="Apenas administradores e professores podem deletar parâmetros",
            )

        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se o registro existe
            cur.execute(
                "SELECT activity_param_id FROM activity_params WHERE activity_param_id = %s",
                (activity_param_id,),
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=404, detail="Parâmetros não encontrados"
                )

            # Soft delete: inativar o registro (SCD Tipo 2)
            cur.execute(
                """
                UPDATE activity_params
                SET active = FALSE, ended_at = NOW()
                WHERE activity_param_id = %s
            """,
                (activity_param_id,),
            )

            conn.commit()
            return None
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao deletar parâmetros: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao deletar parâmetros: {str(e)}"
        )
    finally:
        if conn:
            conn.close()
