from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import bcrypt
import logging
from dotenv import load_dotenv
from app.routes.auth import get_current_user, TokenData

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["Users"])


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
                password=os.getenv("DB_PASSWORD", "postgres"),
            )
        return conn
    except psycopg2.OperationalError as e:
        error_msg = (
            f"Erro ao conectar ao banco de dados. "
            f"Verifique se o PostgreSQL está rodando e as credenciais "
            f"estão corretas: {str(e)}"
        )
        raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        error_msg = f"Erro ao conectar ao banco: {str(e)}"
        raise HTTPException(status_code=500, detail=error_msg)


# Modelos Pydantic
class UserCreate(BaseModel):
    user_name: str
    user_type: str  # Qualquer tipo de usuário (aluno, professor, administrador, etc.)
    password: str


class UserUpdate(BaseModel):
    user_name: Optional[str] = None
    user_type: Optional[str] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    user_id: int
    user_name: str
    user_type: str
    created_at: datetime

    class Config:
        from_attributes = True


# Função helper para verificar se há usuários no sistema
def has_users() -> bool:
    """Verifica se existem usuários no sistema"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as count FROM users")
            result = cur.fetchone()
            return result[0] > 0 if result else False
    except Exception:
        return False
    finally:
        if conn:
            conn.close()


# Dependência opcional para autenticação
security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[TokenData]:
    """Obtém o usuário atual se autenticado, caso contrário retorna None"""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except Exception:
        return None


@router.get("/", response_model=List[UserResponse])
async def list_users(current_user: TokenData = Depends(get_current_user)):
    """Lista todos os usuários"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT user_id, user_name, user_type, created_at
                FROM users
                ORDER BY created_at DESC
            """
            )
            users = cur.fetchall()
            return [dict(user) for user in users]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar usuários: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao listar usuários: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int):
    """Obtém um usuário específico por ID"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT user_id, user_name, user_type, created_at
                FROM users
                WHERE user_id = %s
            """,
                (user_id,),
            )
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="Usuário não encontrado")
            return dict(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter usuário {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao obter usuário: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    user: UserCreate,
    current_user: Optional[TokenData] = Depends(get_current_user_optional),
):
    """
    Cria um novo usuário.
    Se não houver usuários no sistema, permite criar sem autenticação.
    Caso contrário, requer autenticação.
    """
    conn = None
    try:
        # Verificar se há usuários no sistema
        system_has_users = has_users()

        # Se já existem usuários, requer autenticação
        if system_has_users and current_user is None:
            raise HTTPException(
                status_code=401,
                detail="Autenticação necessária para criar usuários quando já existem usuários no sistema",
            )

        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verificar se o usuário já existe antes de tentar inserir
            cur.execute(
                "SELECT user_id FROM users WHERE user_name = %s",
                (user.user_name,),
            )
            existing_user = cur.fetchone()
            if existing_user:
                raise HTTPException(status_code=400, detail="Nome de usuário já existe")

            # Hash da senha
            salt = bcrypt.gensalt()
            hash_password = bcrypt.hashpw(user.password.encode("utf-8"), salt)
            # Converte bytes para string para armazenar no banco
            hash_password_str = hash_password.decode("utf-8")

            cur.execute(
                """
                INSERT INTO users (user_name, user_type, hash_password)
                VALUES (%s, %s, %s)
                RETURNING user_id, user_name, user_type, created_at
            """,
                (user.user_name, user.user_type, hash_password_str),
            )
            new_user = cur.fetchone()
            conn.commit()
            return dict(new_user)
    except psycopg2.IntegrityError as e:
        if conn:
            conn.rollback()
        error_message = str(e)
        logger.error(f"Erro de integridade ao criar usuário: {error_message}")

        # Verificar se é erro de constraint UNIQUE (nome duplicado)
        if "unique" in error_message.lower() or "duplicate" in error_message.lower():
            raise HTTPException(status_code=400, detail="Nome de usuário já existe")
        else:
            # Outro tipo de erro de integridade
            raise HTTPException(
                status_code=400,
                detail=f"Erro de integridade: {error_message}",
            )
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


def _validate_user_type(user_type: Optional[str]):
    """Valida o tipo de usuário (removida restrição para permitir categorias customizadas)"""
    # Validação removida para permitir qualquer tipo de usuário
    pass


def _hash_password(password: str) -> str:
    """Gera hash da senha"""
    salt = bcrypt.gensalt()
    hash_password = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hash_password.decode("utf-8")


def _build_user_updates(user: UserUpdate):
    """Constrói a lista de updates e values para atualização de usuário"""
    updates = []
    values = []

    if user.user_name is not None:
        updates.append("user_name = %s")
        values.append(user.user_name)

    if user.user_type is not None:
        updates.append("user_type = %s")
        values.append(user.user_type)

    if user.password is not None:
        hash_password_str = _hash_password(user.password)
        updates.append("hash_password = %s")
        values.append(hash_password_str)

    return updates, values


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int, user: UserUpdate, current_user: TokenData = Depends(get_current_user)
):
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
            _validate_user_type(user.user_type)

            # Monta a query dinamicamente baseado nos campos fornecidos
            updates, values = _build_user_updates(user)

            if not updates:
                # Se não há atualizações, retorna o usuário atual
                cur.execute(
                    """
                    SELECT user_id, user_name, user_type, created_at
                    FROM users
                    WHERE user_id = %s
                """,
                    (user_id,),
                )
                return dict(cur.fetchone())

            values.append(user_id)
            query = f"""
                UPDATE users
                SET {', '.join(updates)}
                WHERE user_id = %s
                RETURNING user_id, user_name, user_type, created_at
            """
            cur.execute(query, values)
            updated_user = cur.fetchone()
            conn.commit()
            return dict(updated_user)
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
        raise HTTPException(
            status_code=500, detail=f"Erro ao atualizar usuário: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int, current_user: TokenData = Depends(get_current_user)
):
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
        raise HTTPException(
            status_code=500, detail=f"Erro ao deletar usuário: {str(e)}"
        )
    finally:
        if conn:
            conn.close()
