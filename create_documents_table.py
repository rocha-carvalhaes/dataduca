"""
Script para criar a tabela documents no banco de dados
Execute: python create_documents_table.py
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def create_documents_table():
    """Cria a tabela documents no banco de dados"""
    try:
        # Conectar ao banco
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
        
        cur = conn.cursor()
        
        # Criar tabela documents
        cur.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                document_id SERIAL PRIMARY KEY,
                document_content TEXT NOT NULL,
                created_by INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        
        # Criar índice
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_documents_created_by 
            ON documents(created_by)
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        
        print("Tabela 'documents' criada com sucesso!")
        
    except psycopg2.OperationalError as e:
        print(f"Erro ao conectar ao banco de dados: {e}")
        print("Verifique se o PostgreSQL esta rodando e as credenciais no .env estao corretas.")
    except psycopg2.Error as e:
        print(f"Erro ao criar tabela: {e}")
    except Exception as e:
        print(f"Erro inesperado: {e}")

if __name__ == "__main__":
    create_documents_table()

