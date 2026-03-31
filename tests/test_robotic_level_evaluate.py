"""Testes da avaliação de nível (algoritmo robótico)."""

import os

import pytest

from app.core.level_evaluator import LevelEvaluator


def _session_results(avg_len_per_round):
    """Constrói results com 3 rodadas e uma attempt por rodada (comprimento fixo)."""
    rounds = []
    for _ in range(3):
        prog = ["walk"] * int(avg_len_per_round)
        rounds.append({"attempts": [{"final_program": prog}]})
    return {"rounds": rounds, "rounds_total": 3}


def test_evaluate_robotic_level_up():
    """Média de movimentos por rodada <= limiar => sobe."""
    sessions = [
        {"results": _session_results(2)},
        {"results": _session_results(2)},
        {"results": _session_results(2)},
    ]
    level_up = {
        "games_count": 5,
        "required_games": 3,
        "max_avg_moves_per_round": 4,
    }
    level_down = {"games_count": 5, "required_games": 3, "min_avg_moves_per_round": 20}
    out = LevelEvaluator.evaluate_robotic_activity(
        sessions, level_up, level_down, current_level=1
    )
    assert out is not None
    assert out["action"] == "level_up"


def test_evaluate_robotic_empty_dict_params_does_not_block_level_up():
    """
    Dicts vazios {} não devem impedir subida: antes `if level_up_params` falhava
    porque {} é falsy em Python.
    """
    sessions = [
        {"results": _session_results(2)},
        {"results": _session_results(2)},
        {"results": _session_results(2)},
    ]
    out = LevelEvaluator.evaluate_robotic_activity(sessions, {}, {}, current_level=1)
    assert out is not None
    assert out["action"] == "level_up"


def test_evaluate_robotic_level_down_high_avg():
    sessions = [
        {"results": _session_results(25)},
        {"results": _session_results(25)},
        {"results": _session_results(25)},
    ]
    level_up = {
        "games_count": 5,
        "required_games": 3,
        "max_avg_moves_per_round": 5,
    }
    level_down = {
        "games_count": 5,
        "required_games": 3,
        "min_avg_moves_per_round": 20,
    }
    out = LevelEvaluator.evaluate_robotic_activity(
        sessions, level_up, level_down, current_level=2
    )
    assert out is not None
    assert out["action"] == "level_down"


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL não definido — integração opcional",
)
def test_integration_sessions_for_user_11_robotic():
    """Diagnóstico: sessões recentes do user 11 na atividade robótica (requer BD)."""
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
            assert row is not None, "Atividade algoritmo_robotico não encontrada"
            aid = row["activity_id"]

        sessions = LevelEvaluator.get_recent_sessions(11, aid, limit=15, min_date=None)
        assert isinstance(sessions, list)
        print(f"user_id=11 activity_id={aid} sessions={len(sessions)}")
    finally:
        conn.close()
