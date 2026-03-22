from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import logging
from dotenv import load_dotenv
from app.routes.auth import get_current_user, TokenData

# Carregar variáveis de ambiente
load_dotenv()

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user-sessions", tags=["User Sessions"])


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
class UserSessionResponse(BaseModel):
    user_session_id: int
    user_id: int
    user_name: str
    initiated_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/current", response_model=UserSessionResponse)
async def get_current_user_session(current_user: TokenData = Depends(get_current_user)):
    """Obtém a sessão ativa do usuário atual"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    us.user_session_id,
                    us.user_id,
                    u.user_name,
                    us.initiated_at,
                    us.ended_at
                FROM user_sessions us
                JOIN users u ON us.user_id = u.user_id
                WHERE us.user_id = %s AND us.ended_at IS NULL
                ORDER BY us.initiated_at DESC
                LIMIT 1
            """,
                (current_user.user_id,),
            )
            session = cur.fetchone()
            if not session:
                raise HTTPException(
                    status_code=404, detail="Nenhuma sessão ativa encontrada"
                )
            return dict(session)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter sessão ativa: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao obter sessão ativa: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.get("/", response_model=List[UserSessionResponse])
async def list_user_sessions(current_user: TokenData = Depends(get_current_user)):
    """Lista todas as sessões de usuários"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    us.user_session_id,
                    us.user_id,
                    u.user_name,
                    us.initiated_at,
                    us.ended_at
                FROM user_sessions us
                JOIN users u ON us.user_id = u.user_id
                ORDER BY us.initiated_at DESC
            """)
            sessions = cur.fetchall()
            return [dict(session) for session in sessions]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar sessões de usuários: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao listar sessões: {str(e)}")
    finally:
        if conn:
            conn.close()
