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

router = APIRouter(prefix="/api/user-activity-params", tags=["User Activity Params"])


def is_admin_or_professor(user_type: str) -> bool:
    """Verifica se o usuário tem permissões administrativas"""
    return user_type in ["professor", "administrador"]


class UserActivityParamsCreate(BaseModel):
    activity_id: int
    params: Dict[str, Any]  # JSONB com os parâmetros
    user_id: Optional[int] = None  # Opcional: se não fornecido, usa current_user


class UserActivityParamsUpdate(BaseModel):
    params: Dict[str, Any]


class UserActivityParamsResponse(BaseModel):
    user_activity_params_id: int
    activity_id: int
    user_id: int
    params: Dict[str, Any]
    initiated_at: datetime
    ended_at: Optional[datetime] = None
    active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[UserActivityParamsResponse])
async def list_user_activity_params(
    activity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    active_only: bool = True,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Lista parâmetros de atividade por usuário.
    Por padrão, retorna apenas parâmetros ativos do usuário atual.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT
                    user_activity_params_id,
                    activity_id,
                    user_id,
                    params,
                    initiated_at,
                    ended_at,
                    active
                FROM user_activity_params
                WHERE 1=1
            """
            params = []

            # Se não for admin/professor, filtrar apenas pelo usuário atual
            if not is_admin_or_professor(current_user.user_type):
                query += " AND user_id = %s"
                params.append(current_user.user_id)
            elif user_id:
                query += " AND user_id = %s"
                params.append(user_id)

            if activity_id:
                query += " AND activity_id = %s"
                params.append(activity_id)

            if active_only:
                query += " AND active = TRUE"

            query += " ORDER BY initiated_at DESC"

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


@router.get("/current/{activity_id}", response_model=UserActivityParamsResponse)
async def get_current_user_activity_params(
    activity_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Obtém os parâmetros ativos atuais do usuário para uma atividade específica.
    Se não existir, retorna 404.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    user_activity_params_id,
                    activity_id,
                    user_id,
                    params,
                    initiated_at,
                    ended_at,
                    active
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
            if not result:
                raise HTTPException(
                    status_code=404,
                    detail="Parâmetros não encontrados para este usuário e atividade",
                )
            return dict(result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter parâmetros atuais: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao obter parâmetros: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.post("/", response_model=UserActivityParamsResponse, status_code=201)
async def create_user_activity_params(
    params_data: UserActivityParamsCreate,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Cria novos parâmetros para um usuário e atividade.
    Seguindo SCD Tipo 2: inativa parâmetros anteriores e cria um novo registro.
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

            # Determinar o user_id a ser usado
            # Administradores e professores podem criar para qualquer usuário
            # Alunos só podem criar para si mesmos
            if params_data.user_id is not None:
                if not is_admin_or_professor(current_user.user_type):
                    raise HTTPException(
                        status_code=403,
                        detail="Apenas administradores e professores podem criar parâmetros para outros usuários",
                    )
                # Verificar se o usuário existe
                cur.execute(
                    "SELECT user_id FROM users WHERE user_id = %s",
                    (params_data.user_id,),
                )
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=404, detail="Usuário não encontrado"
                    )
                user_id = params_data.user_id
            else:
                user_id = current_user.user_id

            # Inativar parâmetros anteriores (SCD Tipo 2)
            cur.execute(
                """
                UPDATE user_activity_params
                SET active = FALSE, ended_at = NOW()
                WHERE user_id = %s
                    AND activity_id = %s
                    AND active = TRUE
            """,
                (user_id, params_data.activity_id),
            )

            # Criar novo registro com parâmetros ativos
            cur.execute(
                """
                INSERT INTO user_activity_params (
                    activity_id, user_id, params, active
                )
                VALUES (%s, %s, %s, TRUE)
                RETURNING
                    user_activity_params_id,
                    activity_id,
                    user_id,
                    params,
                    initiated_at,
                    ended_at,
                    active
            """,
                (params_data.activity_id, user_id, json.dumps(params_data.params)),
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


@router.get("/{user_activity_params_id}", response_model=UserActivityParamsResponse)
async def get_user_activity_params(
    user_activity_params_id: int,
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
                    user_activity_params_id,
                    activity_id,
                    user_id,
                    params,
                    initiated_at,
                    ended_at,
                    active
                FROM user_activity_params
                WHERE user_activity_params_id = %s
            """,
                (user_activity_params_id,),
            )
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=404, detail="Parâmetros não encontrados"
                )

            # Verificar permissão: usuários só podem ver seus próprios parâmetros
            # (exceto administradores e professores)
            if (
                not is_admin_or_professor(current_user.user_type)
                and result["user_id"] != current_user.user_id
            ):
                raise HTTPException(status_code=403, detail="Acesso negado")

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
