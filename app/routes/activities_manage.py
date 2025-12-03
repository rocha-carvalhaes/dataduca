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

router = APIRouter(prefix="/api/activities", tags=["Activities Management"])


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
class ActivityCreate(BaseModel):
    activity_name: str
    activity_description: Optional[str] = None
    activity_objective: Optional[str] = None
    activity_version: str = "1.0"


class ActivityUpdate(BaseModel):
    activity_name: Optional[str] = None
    activity_description: Optional[str] = None
    activity_objective: Optional[str] = None
    activity_version: Optional[str] = None


class ActivityResponse(BaseModel):
    activity_id: int
    activity_name: str
    activity_description: Optional[str] = None
    activity_objective: Optional[str] = None
    activity_version: str
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/list", response_model=List[ActivityResponse])
async def list_activities(current_user: TokenData = Depends(get_current_user)):
    """Lista todas as atividades"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT activity_id, activity_name, activity_description,
                       activity_objective, activity_version, updated_at
                FROM activities
                ORDER BY updated_at DESC
            """)
            activities = cur.fetchall()
            return [dict(activity) for activity in activities]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar atividades: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao listar atividades: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/{activity_id}", response_model=ActivityResponse)
async def get_activity(activity_id: int, current_user: TokenData = Depends(get_current_user)):
    """Obtém uma atividade específica por ID"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT activity_id, activity_name, activity_description,
                       activity_objective, activity_version, updated_at
                FROM activities
                WHERE activity_id = %s
            """, (activity_id,))
            activity = cur.fetchone()
            if not activity:
                raise HTTPException(status_code=404, detail="Atividade não encontrada")
            return dict(activity)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter atividade {activity_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao obter atividade: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/", response_model=ActivityResponse, status_code=201)
async def create_activity(activity: ActivityCreate, current_user: TokenData = Depends(get_current_user)):
    """Cria uma nova atividade"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO activities (activity_name, activity_description, activity_objective, activity_version)
                VALUES (%s, %s, %s, %s)
                RETURNING activity_id, activity_name, activity_description,
                          activity_objective, activity_version, updated_at
            """, (activity.activity_name, activity.activity_description,
                  activity.activity_objective, activity.activity_version))
            new_activity = cur.fetchone()
            conn.commit()
            return dict(new_activity)
    except psycopg2.IntegrityError as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro de integridade ao criar atividade: {str(e)}")
        raise HTTPException(status_code=400, detail="Erro ao criar atividade")
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao criar atividade: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao criar atividade: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.put("/{activity_id}", response_model=ActivityResponse)
async def update_activity(activity_id: int, activity: ActivityUpdate, current_user: TokenData = Depends(get_current_user)):
    """Atualiza uma atividade existente"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verifica se a atividade existe
            cur.execute("SELECT activity_id FROM activities WHERE activity_id = %s", (activity_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Atividade não encontrada")

            # Monta a query dinamicamente
            updates = []
            values = []

            if activity.activity_name is not None:
                updates.append("activity_name = %s")
                values.append(activity.activity_name)

            if activity.activity_description is not None:
                updates.append("activity_description = %s")
                values.append(activity.activity_description)

            if activity.activity_objective is not None:
                updates.append("activity_objective = %s")
                values.append(activity.activity_objective)

            if activity.activity_version is not None:
                updates.append("activity_version = %s")
                values.append(activity.activity_version)

            if not updates:
                # Se não há atualizações, retorna a atividade atual
                cur.execute("""
                    SELECT activity_id, activity_name, activity_description,
                           activity_objective, activity_version, updated_at
                    FROM activities
                    WHERE activity_id = %s
                """, (activity_id,))
                return dict(cur.fetchone())

            # Sempre atualiza o updated_at
            updates.append("updated_at = NOW()")
            values.append(activity_id)

            query = f"""
                UPDATE activities
                SET {', '.join(updates)}
                WHERE activity_id = %s
                RETURNING activity_id, activity_name, activity_description,
                          activity_objective, activity_version, updated_at
            """
            cur.execute(query, values)
            updated_activity = cur.fetchone()
            conn.commit()
            return dict(updated_activity)
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao atualizar atividade {activity_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar atividade: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(activity_id: int, current_user: TokenData = Depends(get_current_user)):
    """Deleta uma atividade"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Verifica se a atividade existe
            cur.execute("SELECT activity_id FROM activities WHERE activity_id = %s", (activity_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Atividade não encontrada")

            cur.execute("DELETE FROM activities WHERE activity_id = %s", (activity_id,))
            conn.commit()
            return None
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao deletar atividade {activity_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao deletar atividade: {str(e)}")
    finally:
        if conn:
            conn.close()
