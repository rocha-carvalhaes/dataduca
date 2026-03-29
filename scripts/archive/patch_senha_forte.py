from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
LEVEL_EVAL_APPEND = """

    @staticmethod
    def _extract_strong_password_durations(
        recent_sessions: list, take: int
    ) -> list:
        from app.core.strong_password import extract_duration_ms_from_results
        import json as _json
        out = []
        for session in recent_sessions[:take]:
            results = session.get("results", {})
            if isinstance(results, str):
                results = _json.loads(results)
            if not results.get("validation_passed"):
                continue
            ms = extract_duration_ms_from_results(results)
            if ms is not None:
                out.append(float(ms))
        return out

    @staticmethod
    def evaluate_strong_password_activity(
        recent_sessions: list,
        level_up_params: dict,
        level_down_params: dict,
    ):
        from app.core.strong_password import median
        if not recent_sessions:
            return None
        up_n = level_up_params.get("sessions_count", len(recent_sessions))
        up_min_ok = level_up_params.get("min_successful_sessions", 3)
        max_med = level_up_params.get("max_median_duration_ms")
        down_n = level_down_params.get("sessions_count", len(recent_sessions))
        down_min_ok = level_down_params.get("min_successful_sessions", 3)
        min_med = level_down_params.get("min_median_duration_ms")
        durs_up = LevelEvaluator._extract_strong_password_durations(recent_sessions, up_n)
        if max_med is not None and level_up_params and len(durs_up) >= up_min_ok:
            med = median(durs_up)
            if med is not None and med <= float(max_med):
                return {
                    "action": "level_up",
                    "reason": "median_duration_below_threshold",
                    "median_duration_ms": med,
                    "threshold": max_med,
                    "sessions_evaluated": len(durs_up),
                }
        durs_down = LevelEvaluator._extract_strong_password_durations(recent_sessions, down_n)
        if min_med is not None and level_down_params and len(durs_down) >= down_min_ok:
            med = median(durs_down)
            if med is not None and med >= float(min_med):
                return {
                    "action": "level_down",
                    "reason": "median_duration_above_threshold",
                    "median_duration_ms": med,
                    "threshold": min_med,
                    "sessions_evaluated": len(durs_down),
                }
        return None
"""
def main():
    le = ROOT / "app" / "core" / "level_evaluator.py"
    t = le.read_text(encoding="utf-8")
    mark = "        return LevelEvaluator._check_writing_level(\n            recent_sessions[:down_count], down_required, max_acc, \"DOWN\"\n        )"
    if "evaluate_strong_password_activity" in t:
        print("skip level_evaluator")
        return
    if mark not in t:
        raise SystemExit("marker not found")
    le.write_text(t.replace(mark, mark + LEVEL_EVAL_APPEND, 1), encoding="utf-8")
    print("patched level_evaluator")
if __name__ == "__main__":
    main()
