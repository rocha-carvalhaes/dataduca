from pathlib import Path
p = Path("app/routes/activity_sessions.py")
t = p.read_text(encoding="utf-8")
old = """            cur.execute(
                \"\"\"
                SELECT asess.activity_session_id, asess.user_session_id, asess.ended_at
                FROM activity_sessions asess
                JOIN user_sessions us ON asess.user_session_id = us.user_session_id
                WHERE asess.activity_session_id = %s AND us.user_id = %s
            \"\"\",
                (activity_session_id, current_user.user_id),
            )
            session = cur.fetchone()
            if not session:
                raise HTTPException(
                    status_code=404, detail="Sessão de atividade não encontrada"
                )

            # Verificar se a sessão já estava finalizada antes
            was_already_finalized = session.get("ended_at") is not None

            # Atualizar a sessão com resultados e data de término
            update_query = "UPDATE activity_sessions SET results = %s"
            update_values = [json.dumps(session_data.results)]"""

new = """            cur.execute(
                \"\"\"
                SELECT asess.activity_session_id, asess.user_session_id, asess.ended_at,
                       asess.activity_id
                FROM activity_sessions asess
                JOIN user_sessions us ON asess.user_session_id = us.user_session_id
                WHERE asess.activity_session_id = %s AND us.user_id = %s
            \"\"\",
                (activity_session_id, current_user.user_id),
            )
            session = cur.fetchone()
            if not session:
                raise HTTPException(
                    status_code=404, detail="Sessão de atividade não encontrada"
                )

            # Verificar se a sessão já estava finalizada antes
            was_already_finalized = session.get("ended_at") is not None

            activity_id = session["activity_id"]
            results_to_save = (
                dict(session_data.results)
                if isinstance(session_data.results, dict)
                else {}
            )

            cur.execute(
                "SELECT activity_type FROM activities WHERE activity_id = %s",
                (activity_id,),
            )
            at_row = cur.fetchone()
            activity_type = (at_row or {}).get("activity_type")

            if activity_type == "senha_forte":
                cur.execute(
                    \"\"\"
                    SELECT ap.level_params
                    FROM user_activity_params uap
                    JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                    WHERE uap.user_id = %s AND ap.activity_id = %s
                        AND uap.active = TRUE AND ap.active = TRUE
                    ORDER BY uap.initiated_at DESC
                    LIMIT 1
                    \"\"\",
                    (current_user.user_id, activity_id),
                )
                lp_row = cur.fetchone()
                if not lp_row or not lp_row.get("level_params"):
                    raise HTTPException(
                        status_code=400,
                        detail="Parâmetros de nível não encontrados para esta atividade.",
                    )
                lp = lp_row["level_params"]
                if isinstance(lp, str):
                    lp = json.loads(lp)
                from app.core.strong_password import finalize_senha_forte_results

                results_to_save = finalize_senha_forte_results(results_to_save, lp)

            # Atualizar a sessão com resultados e data de término
            update_query = "UPDATE activity_sessions SET results = %s"
            update_values = [json.dumps(results_to_save)]"""

if "finalize_senha_forte_results" in t:
    print("activity_sessions already patched")
elif old not in t:
    raise SystemExit("anchor not found for activity_sessions")
else:
    p.write_text(t.replace(old, new, 1), encoding="utf-8")
    print("patched activity_sessions")
