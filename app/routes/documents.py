from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import logging
from dotenv import load_dotenv
from app.core.roles import is_staff
from app.routes.auth import get_current_user, TokenData

# Carregar variáveis de ambiente
load_dotenv()

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])


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
class DocumentCreate(BaseModel):
    document_name: str
    document_content: str


class DocumentUpdate(BaseModel):
    document_name: Optional[str] = None
    document_content: Optional[str] = None


class DocumentResponse(BaseModel):
    document_id: int
    document_name: str
    document_content: str
    created_by: int
    created_by_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(current_user: TokenData = Depends(get_current_user)):
    """Lista documentos: aluno só os próprios; staff vê todos."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            base = """
                SELECT
                    d.document_id,
                    d.document_name,
                    d.document_content,
                    d.created_by,
                    u.user_name as created_by_name,
                    d.created_at,
                    d.updated_at
                FROM documents d
                JOIN users u ON d.created_by = u.user_id
            """
            if is_staff(current_user.user_type):
                cur.execute(base + " ORDER BY d.updated_at DESC")
            else:
                cur.execute(
                    base + " WHERE d.created_by = %s ORDER BY d.updated_at DESC",
                    (current_user.user_id,),
                )
            documents = cur.fetchall()
            return [dict(doc) for doc in documents]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar documentos: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao listar documentos: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int, current_user: TokenData = Depends(get_current_user)
):
    """Obtém um documento específico por ID"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    d.document_id,
                    d.document_name,
                    d.document_content,
                    d.created_by,
                    u.user_name as created_by_name,
                    d.created_at,
                    d.updated_at
                FROM documents d
                JOIN users u ON d.created_by = u.user_id
                WHERE d.document_id = %s
            """,
                (document_id,),
            )
            document = cur.fetchone()
            if not document:
                raise HTTPException(status_code=404, detail="Documento não encontrado")
            if (
                not is_staff(current_user.user_type)
                and document["created_by"] != current_user.user_id
            ):
                raise HTTPException(status_code=403, detail="Permissão negada")
            return dict(document)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter documento {document_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao obter documento: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.post("/", response_model=DocumentResponse, status_code=201)
async def create_document(
    document: DocumentCreate, current_user: TokenData = Depends(get_current_user)
):
    """Cria um novo documento"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO documents (document_name, document_content, created_by)
                VALUES (%s, %s, %s)
                RETURNING document_id, document_name, document_content, created_by, created_at, updated_at
            """,
                (
                    document.document_name,
                    document.document_content,
                    current_user.user_id,
                ),
            )
            new_document = cur.fetchone()

            # Buscar nome do criador
            cur.execute(
                "SELECT user_name FROM users WHERE user_id = %s",
                (current_user.user_id,),
            )
            creator = cur.fetchone()

            conn.commit()

            result = dict(new_document)
            result["created_by_name"] = (
                creator["user_name"] if creator else current_user.user_name
            )
            return result
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao criar documento: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao criar documento: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document: DocumentUpdate,
    current_user: TokenData = Depends(get_current_user),
):
    """Atualiza um documento existente"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verifica se o documento existe
            cur.execute(
                """
                SELECT document_id, created_by
                FROM documents
                WHERE document_id = %s
            """,
                (document_id,),
            )
            existing = cur.fetchone()

            if not existing:
                raise HTTPException(status_code=404, detail="Documento não encontrado")

            if (
                not is_staff(current_user.user_type)
                and existing["created_by"] != current_user.user_id
            ):
                raise HTTPException(status_code=403, detail="Permissão negada")

            # Monta a query dinamicamente
            updates = []
            values = []

            if document.document_name is not None:
                updates.append("document_name = %s")
                values.append(document.document_name)

            if document.document_content is not None:
                updates.append("document_content = %s")
                values.append(document.document_content)

            if not updates:
                # Se não há atualizações, retorna o documento atual
                cur.execute(
                    """
                    SELECT document_id, document_name, document_content, created_by, created_at, updated_at
                    FROM documents
                    WHERE document_id = %s
                """,
                    (document_id,),
                )
                doc = cur.fetchone()
                cur.execute(
                    "SELECT user_name FROM users WHERE user_id = %s",
                    (doc["created_by"],),
                )
                creator = cur.fetchone()
                result = dict(doc)
                result["created_by_name"] = (
                    creator["user_name"] if creator else "Desconhecido"
                )
                return result

            # Sempre atualiza o updated_at
            updates.append("updated_at = NOW()")
            values.append(document_id)

            query = f"""
                UPDATE documents
                SET {', '.join(updates)}
                WHERE document_id = %s
                RETURNING document_id, document_name, document_content, created_by, created_at, updated_at
            """
            cur.execute(query, values)
            updated_document = cur.fetchone()

            # Buscar nome do criador
            cur.execute(
                "SELECT user_name FROM users WHERE user_id = %s",
                (updated_document["created_by"],),
            )
            creator = cur.fetchone()

            conn.commit()

            result = dict(updated_document)
            result["created_by_name"] = (
                creator["user_name"] if creator else "Desconhecido"
            )
            return result
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(
            f"Erro ao atualizar documento {document_id}: {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Erro ao atualizar documento: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: int, current_user: TokenData = Depends(get_current_user)
):
    """Deleta um documento"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Verifica se o documento existe
            cur.execute(
                "SELECT document_id, created_by FROM documents WHERE document_id = %s",
                (document_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Documento não encontrado")
            if not is_staff(current_user.user_type) and row[1] != current_user.user_id:
                raise HTTPException(status_code=403, detail="Permissão negada")

            cur.execute("DELETE FROM documents WHERE document_id = %s", (document_id,))
            conn.commit()
            return None
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(
            f"Erro ao deletar documento {document_id}: {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Erro ao deletar documento: {str(e)}"
        )
    finally:
        if conn:
            conn.close()
