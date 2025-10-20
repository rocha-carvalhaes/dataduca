from pydantic_settings import BaseSettings

# Configurações base da aplicação
class Settings(BaseSettings):
    APP_NAME: str = "Dataduca"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Boa prática para carregar as variáveis de ambiente
    # Sobrescreve as variáveis declaradas acima caso necessário
    class Config:
        env_file = ".env"
        
# Instancia o objeto com as configurações
settings = Settings()