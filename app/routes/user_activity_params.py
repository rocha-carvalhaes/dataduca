from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from psycopg2.extras import RealDictCursor
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
    activity_param_id: int
    activity_id: Optional[int] = None  # Opcional: usado para inativar todos os parâmetros da mesma atividade
    user_id: Optional[int] = None  # Opcional: se não fornecido, usa current_user


class UserActivityParamsResponse(BaseModel):
    user_activity_params_id: int
    activity_param_id: int
    user_id: int
    initiated_at: datetime
    ended_at: Optional[datetime] = None
    active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[UserActivityParamsResponse])
async def list_user_activity_params(
    activity_param_id: Optional[int] = None,
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
                    activity_param_id,
                    user_id,
                    initiated_at,
                    ended_at,
                    active
                FROM user_activity_params
                WHERE activity_param_id IS NOT NULL
            """
            params = []

            # Se não for admin/professor, filtrar apenas pelo usuário atual
            if not is_admin_or_professor(current_user.user_type):
                query += " AND user_id = %s"
                params.append(current_user.user_id)
            elif user_id:
                query += " AND user_id = %s"
                params.append(user_id)

            if activity_param_id:
                query += " AND activity_param_id = %s"
                params.append(activity_param_id)

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


@router.get("/current/{activity_param_id}", response_model=UserActivityParamsResponse)
async def get_current_user_activity_params(
    activity_param_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Obtém os parâmetros ativos atuais do usuário para um parâmetro de nível específico.
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
                    activity_param_id,
                    user_id,
                    initiated_at,
                    ended_at,
                    active
                FROM user_activity_params
                WHERE user_id = %s
                    AND activity_param_id = %s
                    AND activity_param_id IS NOT NULL
                    AND active = TRUE
                ORDER BY initiated_at DESC
                LIMIT 1
            """,
                (current_user.user_id, activity_param_id),
            )
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=404,
                    detail="Parâmetros não encontrados para este usuário e parâmetro de nível",
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
    Cria novos parâmetros para um usuário e parâmetro de nível.
    Seguindo SCD Tipo 2: inativa parâmetros anteriores e cria um novo registro.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se o parâmetro de nível existe
            cur.execute(
                "SELECT activity_param_id FROM activity_params WHERE activity_param_id = %s",
                (params_data.activity_param_id,),
            )
            if not cur.fetchone():
                raise HTTPException(
                    status_code=404, detail="Parâmetro de nível não encontrado"
                )

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

            # Buscar o activity_id do parâmetro selecionado se não foi fornecido
            activity_id_to_inactivate = params_data.activity_id
            if not activity_id_to_inactivate:
                cur.execute(
                    "SELECT activity_id FROM activity_params WHERE activity_param_id = %s",
                    (params_data.activity_param_id,),
                )
                activity_param_result = cur.fetchone()
                if activity_param_result:
                    activity_id_to_inactivate = activity_param_result["activity_id"]

            # Inativar todos os parâmetros anteriores do mesmo usuário e mesma atividade (SCD Tipo 2)
            # Isso garante que apenas um nível por atividade esteja ativo por usuário
            if activity_id_to_inactivate:
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
                    (user_id, activity_id_to_inactivate),
                )

            # Criar novo registro com parâmetros ativos
            cur.execute(
                """
                INSERT INTO user_activity_params (
                    activity_param_id, user_id, active
                )
                VALUES (%s, %s, TRUE)
                RETURNING
                    user_activity_params_id,
                    activity_param_id,
                    user_id,
                    initiated_at,
                    ended_at,
                    active
            """,
                (params_data.activity_param_id, user_id),
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
                    activity_param_id,
                    user_id,
                    initiated_at,
                    ended_at,
                    active
                FROM user_activity_params
                WHERE user_activity_params_id = %s
                    AND activity_param_id IS NOT NULL
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
