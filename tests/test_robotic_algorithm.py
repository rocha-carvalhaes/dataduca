from app.core.robotic_algorithm import (
    filter_scenarios_for_level,
    initial_session_results,
    level_thresholds_for_level,
    pick_scenario_index,
    pick_scenario_index_in_eligible,
    run_program,
    scenario_seed,
    session_avg_moves_per_round,
)


def test_run_program_simple_collect():
    scenario = {
        "grid_size": 3,
        "robot_start": {"x": 1, "y": 2, "direction": 0},
        "stars": [{"x": 1, "y": 1}],
        "obstacles": [],
    }
    ok, events, steps = run_program(["walk", "collect"], scenario)
    assert ok is True
    assert "+walk" in events
    assert "+collect" in events
    assert steps == 2


def test_run_program_wall():
    scenario = {
        "grid_size": 3,
        "robot_start": {"x": 0, "y": 0, "direction": 3},
        "stars": [{"x": 2, "y": 2}],
        "obstacles": [],
    }
    ok, events, _ = run_program(["walk"], scenario)
    assert ok is False


def test_session_avg_moves_per_round():
    results = {
        "rounds": [
            {
                "attempts": [
                    {"final_program": ["walk", "walk"]},
                    {"final_program": ["walk", "walk", "collect"]},
                ]
            },
            {"attempts": [{"final_program": ["walk"]}]},
        ]
    }
    avg = session_avg_moves_per_round(results)
    # round0 mean = (2+3)/2 = 2.5, round1 mean = 1 -> overall (2.5+1)/2 = 1.75
    assert abs(avg - 1.75) < 0.001


def test_initial_session_results():
    r = initial_session_results(3, [0, 5, 2])
    assert r["rounds_total"] == 3
    assert len(r["rounds"]) == 3
    assert r["rounds"][1]["scenario_index"] == 5


def test_pick_scenario_index_deterministic():
    assert pick_scenario_index(12345, 17) == 12345 % 17


def test_level_thresholds():
    up, down = level_thresholds_for_level(1)
    assert up == 4.0
    assert down is None
    up2, down2 = level_thresholds_for_level(2)
    assert up2 == 5.0
    assert down2 == 20.0


def test_scenario_seed_stable():
    assert scenario_seed(1, 2, 1) == scenario_seed(1, 2, 1)


def test_filter_scenarios_for_level():
    scenarios = [
        {"scenario_tier": 1, "title": "A"},
        {"scenario_tier": 3, "title": "B"},
    ]
    f1 = filter_scenarios_for_level(scenarios, 1)
    assert len(f1) == 1
    assert f1[0]["scenario_tier"] == 1
    f3 = filter_scenarios_for_level(scenarios, 3)
    assert len(f3) == 1
    assert f3[0]["scenario_tier"] == 3
    f2 = filter_scenarios_for_level(scenarios, 2)
    assert f2 == []


def test_filter_scenarios_for_level_tierless_returns_all():
    """Cenários já escopados por activity_params.level (sem scenario_tier no JSON)."""
    scenarios = [
        {"grid_size": 3, "robot_start": {"x": 0, "y": 0, "direction": 0}},
        {"grid_size": 5, "robot_start": {"x": 1, "y": 1, "direction": 1}},
    ]
    out = filter_scenarios_for_level(scenarios, 7)
    assert len(out) == 2
    assert out[0]["grid_size"] == 3


def test_pick_scenario_index_in_eligible():
    el = [{"a": 1}, {"b": 2}, {"c": 3}]
    assert pick_scenario_index_in_eligible(10, el) == 10 % 3
