from pydantic_settings import BaseSettings

# Configurações base da aplicação
class Settings(BaseSettings):
    APP_NAME: str = "Dataduca"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    
    # Configurações do banco de dados (opcionais, podem vir do .env)
    DB_HOST: str = "localhost"
    DB_PORT: str = "5432"
    DB_NAME: str = "dataduca"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DATABASE_URL: str | None = None

    # Boa prática para carregar as variáveis de ambiente
    # Sobrescreve as variáveis declaradas acima caso necessário
    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignora campos extras no .env que não estão definidos aqui
        
# Instancia o objeto com as configurações
settings = Settings()