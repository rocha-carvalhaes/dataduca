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
                password=os.getenv("DB_PASSWORD", "postgres")
            )
        return conn
    except psycopg2.OperationalError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao conectar ao banco de dados: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao conectar ao banco: {str(e)}")


# Modelos Pydantic
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


@router.get("/", response_model=List[ActivitySessionResponse])
async def list_activity_sessions(current_user: TokenData = Depends(get_current_user)):
    """Lista todas as sessões de atividades"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
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
            """)
            sessions = cur.fetchall()
            return [dict(session) for session in sessions]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar sessões de atividades: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao listar sessões de atividades: {str(e)}")
    finally:
        if conn:
            conn.close()

