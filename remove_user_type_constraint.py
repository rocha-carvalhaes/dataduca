"""
Script para remover a constraint CHECK do campo user_type
Execute: python remove_user_type_constraint.py
"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()


def remove_user_type_constraint():
    """Remove a constraint CHECK do campo user_type"""
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
                password=os.getenv("DB_PASSWORD", "postgres"),
            )

        cur = conn.cursor()

        # Remover a constraint CHECK
        cur.execute(
            "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;"
        )

        conn.commit()
        cur.close()
        conn.close()

        print("Constraint 'users_user_type_check' removida com sucesso!")
        print("Agora voce pode criar usuarios de qualquer tipo (aluno, professor, administrador, etc.)")

    except psycopg2.OperationalError as e:
        print(f"Erro ao conectar ao banco de dados: {e}")
        print(
            "Verifique se o PostgreSQL esta rodando e as credenciais no .env estao corretas."
        )
    except psycopg2.Error as e:
        print(f"Erro ao remover constraint: {e}")
    except Exception as e:
        print(f"Erro inesperado: {e}")


if __name__ == "__main__":
    remove_user_type_constraint()

