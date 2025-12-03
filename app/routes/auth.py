from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime, timedelta
import bcrypt
import logging
from dotenv import load_dotenv
from jose import JWTError, jwt

# Carregar variáveis de ambiente
load_dotenv()

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Configuração JWT
SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "your-secret-key-change-in-production"
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 horas

# Security scheme
security = HTTPBearer()


# Configuração do banco de dados
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
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    user_name: str
    user_type: str


class TokenData(BaseModel):
    user_id: int
    user_name: str
    user_type: str


class UserInfo(BaseModel):
    user_id: int
    user_name: str
    user_type: str


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Cria um token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha está correta"""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        logger.error(f"Erro ao verificar senha: {str(e)}")
        return False


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> TokenData:
    """Obtém o usuário atual a partir do token JWT"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        user_name: str = payload.get("user_name")
        user_type: str = payload.get("user_type")

        if user_id is None or user_name is None or user_type is None:
            raise credentials_exception

        return TokenData(user_id=user_id, user_name=user_name, user_type=user_type)
    except JWTError:
        raise credentials_exception


@router.post("/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    """Autentica um usuário e retorna um token JWT"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Buscar usuário pelo nome
            cur.execute("""
                SELECT user_id, user_name, user_type, hash_password
                FROM users
                WHERE user_name = %s
            """, (login_data.username,))
            user = cur.fetchone()

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuário ou senha incorretos"
                )

            # Verificar senha
            if not verify_password(login_data.password, user['hash_password']):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuário ou senha incorretos"
                )

            # Encerrar sessões ativas do usuário antes de criar uma nova
            cur.execute("""
                UPDATE user_sessions
                SET ended_at = NOW()
                WHERE user_id = %s
                AND ended_at IS NULL
            """, (user['user_id'],))

            # Criar nova sessão no banco
            cur.execute("""
                INSERT INTO user_sessions (user_id)
                VALUES (%s)
                RETURNING user_session_id
            """, (user['user_id'],))
            session = cur.fetchone()
            conn.commit()

            # Criar token JWT
            access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={
                    "user_id": user['user_id'],
                    "user_name": user['user_name'],
                    "user_type": user['user_type'],
                    "user_session_id": session['user_session_id']
                },
                expires_delta=access_token_expires
            )

            return LoginResponse(
                access_token=access_token,
                token_type="bearer",
                user_id=user['user_id'],
                user_name=user['user_name'],
                user_type=user['user_type']
            )
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao fazer login: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao fazer login: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.post("/logout")
async def logout(current_user: TokenData = Depends(get_current_user)):
    """Encerra a sessão do usuário"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Marcar sessão como encerrada
            # Usar subquery para pegar a última sessão ativa
            cur.execute("""
                UPDATE user_sessions
                SET ended_at = NOW()
                WHERE user_session_id = (
                    SELECT user_session_id
                    FROM user_sessions
                    WHERE user_id = %s
                    AND ended_at IS NULL
                    ORDER BY initiated_at DESC
                    LIMIT 1
                )
            """, (current_user.user_id,))
            conn.commit()
            return {"message": "Logout realizado com sucesso"}
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Erro ao fazer logout: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao fazer logout: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(current_user: TokenData = Depends(get_current_user)):
    """Retorna informações do usuário autenticado"""
    return UserInfo(
        user_id=current_user.user_id,
        user_name=current_user.user_name,
        user_type=current_user.user_type
    )


@router.get("/verify")
async def verify_token(current_user: TokenData = Depends(get_current_user)):
    """Verifica se o token é válido"""
    return {"valid": True, "user": current_user}
