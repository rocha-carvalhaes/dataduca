from pathlib import Path

p = Path("app/routes/user_levels.py")
t = p.read_text(encoding="utf-8")
if "senha_forte" in t and "evaluate_strong_password_activity" in t:
    print("skip senha_forte branch")
    raise SystemExit(0)
old = """            elif activity_type == "escrita":
                evaluation = LevelEvaluator.evaluate_writing_activity(
                    recent_sessions, level_up_params, level_down_params
                )
                logger.info(f"Resultado avaliação escrita: {evaluation}")
            else:"""
new = """            elif activity_type == "escrita":
                evaluation = LevelEvaluator.evaluate_writing_activity(
                    recent_sessions, level_up_params, level_down_params
                )
                logger.info(f"Resultado avaliação escrita: {evaluation}")
            elif activity_type == "senha_forte":
                evaluation = LevelEvaluator.evaluate_strong_password_activity(
                    recent_sessions, level_up_params, level_down_params
                )
                logger.info(f"Resultado avaliação senha forte: {evaluation}")
            else:"""
if old not in t:
    raise SystemExit("anchor not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("patched user_levels senha_forte")
