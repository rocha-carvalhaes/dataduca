from pathlib import Path
p = Path("app/routes/user_levels.py")
t = p.read_text(encoding="utf-8")
old = """            games_count = max(
                level_up_params.get("games_count", 10),
                level_down_params.get("games_count", 10),
            )"""
new = """            games_count = max(
                level_up_params.get("games_count", 10),
                level_down_params.get("games_count", 10),
                level_up_params.get("sessions_count", 0),
                level_down_params.get("sessions_count", 0),
            )
            if games_count == 0:
                games_count = 10"""
if "sessions_count" in t and "level_up_params.get(\"sessions_count\"" in t:
    print("skip games_count")
elif old in t:
    p.write_text(t.replace(old, new, 1), encoding="utf-8")
    print("patched games_count")
else:
    raise SystemExit("block not found")
