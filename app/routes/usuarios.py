from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import bcrypt
import logging
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/usuarios", tags=["Usuários"])

# Configuração do banco de dados
def get_db_connection():
    """Cria e retorna uma conexão com o banco de dados"""
    try:
        # Tenta usar DATABASE_URL se disponível, senão usa parâmetros individuais
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            conn = psycopg2.connect(database_url)
        else:
            # Parâmetros individuais como fallback
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
            detail=f"Erro ao conectar ao banco de dados. Verifique se o PostgreSQL está rodando e as credenciais estão corretas: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao conectar ao banco: {str(e)}")


# Modelos Pydantic
class UsuarioCreate(BaseModel):
    user_name: str
    user_type: str  # 'aluno' ou 'professor'
    password: str


class UsuarioUpdate(BaseModel):
    user_name: Optional[str] = None
    user_type: Optional[str] = None
    password: Optional[str] = None


class UsuarioResponse(BaseModel):
    user_id: int
    user_name: str
    user_type: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[UsuarioResponse])
async def listar_usuarios():
    """Lista todos os usuários"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT user_id, user_name, user_type, created_at
                FROM users
                ORDER BY created_at DESC
            """)
            usuarios = cur.fetchall()
            return [dict(usuario) for usuario in usuarios]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar usuários: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao listar usuários: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/{user_id}", response_model=UsuarioResponse)
async def obter_usuario(user_id: int):
    """Obtém um usuário específico por ID"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT user_id, user_name, user_type, created_at
                FROM users
                WHERE user_id = %s
            """, (user_id,))
            usuario = cur.fetchone()
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuário não encontrado")
            return dict(usuario)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter usuário {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao obter usuário: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/", response_model=UsuarioResponse, status_code=201)
async def criar_usuario(usuario: UsuarioCreate):
    """Cria um novo usuário"""
    # Validação do tipo de usuário
    if usuario.user_type not in ['aluno', 'professor']:
        raise HTTPException(
            status_code=400,
            detail="user_type deve ser 'aluno' ou 'professor'"
        )
    
    # Hash da senha
    salt = bcrypt.gensalt()
    hash_password = bcrypt.hashpw(usuario.password.encode('utf-8'), salt)
    # Converte bytes para string para armazenar no banco
    hash_password_str = hash_password.decode('utf-8')
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO users (user_name, user_type, hash_password)
                VALUES (%s, %s, %s)
                RETURNING user_id, user_name, user_type, created_at
            """, (usuario.user_name, usuario.user_type, hash_password_str))
            novo_usuario = cur.fetchone()
            conn.commit()
            return dict(novo_usuario)
    except psycopg2.IntegrityError as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro de integridade ao criar usuário: {str(e)}")
        raise HTTPException(status_code=400, detail="Nome de usuário já existe")
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao criar usuário: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao criar usuário: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.put("/{user_id}", response_model=UsuarioResponse)
async def atualizar_usuario(user_id: int, usuario: UsuarioUpdate):
    """Atualiza um usuário existente"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verifica se o usuário existe
            cur.execute("SELECT user_id FROM users WHERE user_id = %s", (user_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Usuário não encontrado")
            
            # Validação do tipo de usuário se fornecido
            if usuario.user_type and usuario.user_type not in ['aluno', 'professor']:
                raise HTTPException(
                    status_code=400,
                    detail="user_type deve ser 'aluno' ou 'professor'"
                )
            
            # Monta a query dinamicamente baseado nos campos fornecidos
            updates = []
            values = []
            
            if usuario.user_name is not None:
                updates.append("user_name = %s")
                values.append(usuario.user_name)
            
            if usuario.user_type is not None:
                updates.append("user_type = %s")
                values.append(usuario.user_type)
            
            if usuario.password is not None:
                salt = bcrypt.gensalt()
                hash_password = bcrypt.hashpw(usuario.password.encode('utf-8'), salt)
                hash_password_str = hash_password.decode('utf-8')
                updates.append("hash_password = %s")
                values.append(hash_password_str)
            
            if not updates:
                # Se não há atualizações, retorna o usuário atual
                cur.execute("""
                    SELECT user_id, user_name, user_type, created_at
                    FROM users
                    WHERE user_id = %s
                """, (user_id,))
                return dict(cur.fetchone())
            
            values.append(user_id)
            query = f"""
                UPDATE users
                SET {', '.join(updates)}
                WHERE user_id = %s
                RETURNING user_id, user_name, user_type, created_at
            """
            cur.execute(query, values)
            usuario_atualizado = cur.fetchone()
            conn.commit()
            return dict(usuario_atualizado)
    except HTTPException:
        raise
    except psycopg2.IntegrityError as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro de integridade ao atualizar usuário {user_id}: {str(e)}")
        raise HTTPException(status_code=400, detail="Nome de usuário já existe")
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao atualizar usuário {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar usuário: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.delete("/{user_id}", status_code=204)
async def deletar_usuario(user_id: int):
    """Deleta um usuário"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Verifica se o usuário existe
            cur.execute("SELECT user_id FROM users WHERE user_id = %s", (user_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Usuário não encontrado")
            
            cur.execute("DELETE FROM users WHERE user_id = %s", (user_id,))
            conn.commit()
            return None
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao deletar usuário {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao deletar usuário: {str(e)}")
    finally:
        if conn:
            conn.close()

