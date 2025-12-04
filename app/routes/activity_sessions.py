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
from app.routes.auth import get_current_user, TokenData

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
async def create_activity_session(
    session_data: ActivitySessionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Cria uma nova sessão de atividade"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Obter a sessão ativa do usuário
            cur.execute("""
                SELECT user_session_id
                FROM user_sessions
                WHERE user_id = %s AND ended_at IS NULL
                ORDER BY initiated_at DESC
                LIMIT 1
            """, (current_user.user_id,))
            user_session = cur.fetchone()
            if not user_session:
                raise HTTPException(
                    status_code=404,
                    detail="Nenhuma sessão de usuário ativa encontrada"
                )

            # Verificar se a atividade existe
            cur.execute("SELECT activity_id FROM activities WHERE activity_id = %s", (session_data.activity_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Atividade não encontrada")

            # Criar a sessão de atividade com results vazio ou inicial
            initial_results = session_data.results or {}
            cur.execute("""
                INSERT INTO activity_sessions (user_session_id, activity_id, results)
                VALUES (%s, %s, %s)
                RETURNING activity_session_id, user_session_id, activity_id, results, initiated_at, ended_at
            """, (user_session['user_session_id'], session_data.activity_id, json.dumps(initial_results)))
            new_session = cur.fetchone()

            # Buscar informações adicionais para a resposta
            cur.execute("""
                SELECT u.user_name, a.activity_name
                FROM user_sessions us
                JOIN users u ON us.user_id = u.user_id
                JOIN activities a ON a.activity_id = %s
                WHERE us.user_session_id = %s
            """, (session_data.activity_id, user_session['user_session_id']))
            info = cur.fetchone()

            conn.commit()
            result = dict(new_session)
            result['user_name'] = info['user_name']
            result['activity_name'] = info['activity_name']
            return result
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao criar sessão de atividade: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao criar sessão de atividade: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.put("/{activity_session_id}", response_model=ActivitySessionResponse)
async def update_activity_session(
    activity_session_id: int,
    session_data: ActivitySessionUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    """Atualiza uma sessão de atividade com os resultados finais"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se a sessão existe e pertence ao usuário
            cur.execute("""
                SELECT asess.activity_session_id, asess.user_session_id
                FROM activity_sessions asess
                JOIN user_sessions us ON asess.user_session_id = us.user_session_id
                WHERE asess.activity_session_id = %s AND us.user_id = %s
            """, (activity_session_id, current_user.user_id))
            session = cur.fetchone()
            if not session:
                raise HTTPException(status_code=404, detail="Sessão de atividade não encontrada")

            # Atualizar a sessão com resultados e data de término
            update_query = "UPDATE activity_sessions SET results = %s"
            update_values = [json.dumps(session_data.results)]

            if session_data.ended_at:
                update_query += ", ended_at = %s"
                update_values.append(session_data.ended_at)
            else:
                update_query += ", ended_at = NOW()"

            update_query += " WHERE activity_session_id = %s RETURNING activity_session_id, user_session_id, activity_id, results, initiated_at, ended_at"
            update_values.append(activity_session_id)

            cur.execute(update_query, update_values)
            updated_session = cur.fetchone()

            # Buscar informações adicionais para a resposta
            cur.execute("""
                SELECT u.user_name, a.activity_name
                FROM activity_sessions asess
                JOIN user_sessions us ON asess.user_session_id = us.user_session_id
                JOIN users u ON us.user_id = u.user_id
                JOIN activities a ON asess.activity_id = a.activity_id
                WHERE asess.activity_session_id = %s
            """, (activity_session_id,))
            info = cur.fetchone()

            conn.commit()
            result = dict(updated_session)
            result['user_name'] = info['user_name']
            result['activity_name'] = info['activity_name']
            return result
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao atualizar sessão de atividade: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar sessão de atividade: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/", response_model=List[ActivitySessionResponse])
async def list_activity_sessions(current_user: TokenData = Depends(get_current_user)):
    """Lista todas as sessões de atividades"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
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
                ORDER BY asess.initiated_at DESC
            """
            )
            sessions = cur.fetchall()
            return [dict(session) for session in sessions]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar sessões de atividades: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao listar sessões de atividades: {str(e)}"
        )
    finally:
        if conn:
            conn.close()
