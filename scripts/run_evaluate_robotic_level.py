#!/usr/bin/env python3
"""
Dispara POST /api/user-levels/evaluate/{user_id}/{activity_id} como staff (override de auth).
Uso (na raiz do projeto, com venv e DATABASE_URL):
  python scripts/run_evaluate_robotic_level.py 11
"""

from __future__ import annotations

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


def main() -> int:
    user_id = int(sys.argv[1]) if len(sys.argv) > 1 else 11

    from fastapi.testclient import TestClient

    from app.main import app
    from app.routes.auth import TokenData, get_current_user
    from app.routes.auth import get_db_connection
    from psycopg2.extras import RealDictCursor

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT activity_id FROM activities
                WHERE activity_type = 'algoritmo_robotico' LIMIT 1
                """)
            row = cur.fetchone()
            if not row:
                print(
                    "Erro: nenhuma atividade com activity_type=algoritmo_robotico",
                    file=sys.stderr,
                )
                return 1
            activity_id = row["activity_id"]
    finally:
        conn.close()

    def fake_staff():
        return TokenData(
            user_id=1,
            user_name="script",
            user_type="administrador",
        )

    app.dependency_overrides[get_current_user] = fake_staff
    try:
        client = TestClient(app)
        url = f"/api/user-levels/evaluate/{user_id}/{activity_id}"
        r = client.post(url)
        print("URL:", url)
        print("Status:", r.status_code)
        try:
            print("Body:", r.json())
        except Exception:
            print(r.text)
        return 0 if r.status_code == 200 else 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


if __name__ == "__main__":
    raise SystemExit(main())
