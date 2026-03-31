"""
Motor e utilitários da atividade «Algoritmo robótico» (grid, comandos, métricas).
Direção: 0=Norte (−y), 1=Leste (+x), 2=Sul (+y), 3=Oeste (−x).
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Tuple

# Comandos canónicos (API / final_program)
CMD_FORWARD = "walk"
CMD_TURN_LEFT = "turn_left"
CMD_TURN_RIGHT = "turn_right"
CMD_COLLECT = "collect"

ALLOWED_COMMANDS = [CMD_FORWARD, CMD_TURN_LEFT, CMD_TURN_RIGHT, CMD_COLLECT]

_EVENT_PREFIX = {
    CMD_FORWARD: "+walk",
    CMD_TURN_LEFT: "+turn_left",
    CMD_TURN_RIGHT: "+turn_right",
    CMD_COLLECT: "+collect",
}


def scenario_seed(activity_session_id: int, user_id: int, round_index: int) -> int:
    h = hashlib.sha256(
        f"algoritmo_robotico:{activity_session_id}:{user_id}:{round_index}".encode(
            "utf-8"
        )
    ).digest()
    return int.from_bytes(h[:8], "big")


def pick_scenario_index(seed: int, num_scenarios: int) -> int:
    if num_scenarios <= 0:
        return 0
    return seed % num_scenarios


def infer_scenario_tier(scenario: Dict[str, Any]) -> int:
    """Lê scenario_tier ou extrai 'Nível X' do título."""
    raw = scenario.get("scenario_tier")
    if raw is not None:
        try:
            return max(1, min(10, int(raw)))
        except (TypeError, ValueError):
            pass
    title = str(scenario.get("title") or "")
    m = re.search(r"Nível\s*(\d+)", title, re.IGNORECASE)
    if m:
        return max(1, min(10, int(m.group(1))))
    return 1


def _any_scenario_has_tier_field(scenarios: List[Dict[str, Any]]) -> bool:
    """True se pelo menos um item tiver scenario_tier (ex.: lista global do ficheiro JSON)."""
    return any(s.get("scenario_tier") is not None for s in scenarios)


def filter_scenarios_for_level(
    scenarios: List[Dict[str, Any]], user_level: int
) -> List[Dict[str, Any]]:
    """
    - Cenários **sem** ``scenario_tier`` em nenhum item: lista já escopada por
      ``activity_params.level`` — devolve a lista completa.
    - Cenários **com** ``scenario_tier`` (ficheiro em disco com vários níveis):
      mantém só os cujo tier coincide com o nível do utilizador.
    """
    if not scenarios:
        return []
    ul = max(1, min(10, int(user_level)))
    if not _any_scenario_has_tier_field(scenarios):
        return list(scenarios)
    return [s for s in scenarios if infer_scenario_tier(s) == ul]


def pick_scenario_index_in_eligible(seed: int, eligible: List[Dict[str, Any]]) -> int:
    """Índice no array filtrado (mesmo espaço que o GET expõe ao cliente)."""
    n = len(eligible)
    if n <= 0:
        return 0
    return seed % n


def _normalize_cmd(cmd: str) -> Optional[str]:
    if not cmd:
        return None
    c = str(cmd).strip().lower()
    aliases = {
        "forward": CMD_FORWARD,
        "andar": CMD_FORWARD,
        "turnleft": CMD_TURN_LEFT,
        "left": CMD_TURN_LEFT,
        "turn_right": CMD_TURN_RIGHT,
        "right": CMD_TURN_RIGHT,
        "collect": CMD_COLLECT,
        "coletar": CMD_COLLECT,
    }
    if c in ALLOWED_COMMANDS:
        return c
    return aliases.get(c.replace("_", ""))


def run_program(  # noqa: C901
    commands: List[str],
    scenario: Dict[str, Any],
) -> Tuple[bool, List[str], int]:
    """
    Executa o programa no cenário.
    Retorna: (sucesso, events estilo +walk, passos_executados).
    """
    grid_size = int(scenario.get("grid_size", 3))
    rs = scenario.get("robot_start") or scenario.get("robotStart") or {}
    x = int(rs.get("x", 0))
    y = int(rs.get("y", 0))
    direction = int(rs.get("direction", 0)) % 4

    stars_raw = scenario.get("stars") or []
    stars_remaining = {(int(s["x"]), int(s["y"])) for s in stars_raw}
    obstacles = scenario.get("obstacles") or []
    obs_set = {(int(o["x"]), int(o["y"])) for o in obstacles}

    events: List[str] = []
    steps = 0

    for raw in commands:
        cmd = _normalize_cmd(raw)
        if cmd is None or cmd not in ALLOWED_COMMANDS:
            continue
        steps += 1
        ev = _EVENT_PREFIX.get(cmd, f"+{cmd}")
        events.append(ev)

        if cmd == CMD_TURN_LEFT:
            direction = (direction + 3) % 4
        elif cmd == CMD_TURN_RIGHT:
            direction = (direction + 1) % 4
        elif cmd == CMD_FORWARD:
            nx, ny = x, y
            if direction == 0:
                ny -= 1
            elif direction == 1:
                nx += 1
            elif direction == 2:
                ny += 1
            else:
                nx -= 1
            if nx < 0 or nx >= grid_size or ny < 0 or ny >= grid_size:
                return False, events, steps
            if (nx, ny) in obs_set:
                return False, events, steps
            x, y = nx, ny
        elif cmd == CMD_COLLECT:
            if (x, y) in stars_remaining:
                stars_remaining.discard((x, y))

    ok = len(stars_remaining) == 0
    return ok, events, steps


def load_default_scenarios_from_disk() -> List[Dict[str, Any]]:
    """
    Mantido por compatibilidade com rotas que fazem merge; devolve lista vazia.
    Cenários vêm apenas de ``activity_params.level_params.scenarios`` na base de dados.
    """
    return []


def initial_session_results(
    rounds_total: int = 3,
    scenario_indices: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Estrutura inicial de results ao criar sessão."""
    n = max(1, min(10, rounds_total))
    rounds: List[Dict[str, Any]] = []
    for i in range(n):
        idx = (
            scenario_indices[i] if scenario_indices and i < len(scenario_indices) else 0
        )
        rounds.append({"scenario_index": idx, "attempts": []})
    return {
        "json_format_version": 1,
        "current_round": 1,
        "rounds_total": n,
        "rounds": rounds,
    }


def session_avg_moves_per_round(results: Dict[str, Any]) -> Optional[float]:
    """
    Média das médias de len(final_program) por rodada (todas as attempts contam).
    """
    if isinstance(results, str):
        results = json.loads(results)
    rounds = results.get("rounds") or []
    if not rounds:
        return None
    round_means: List[float] = []
    for r in rounds:
        attempts = r.get("attempts") or []
        if not attempts:
            continue
        lengths: List[int] = []
        for a in attempts:
            fp = a.get("final_program") or []
            if isinstance(fp, list):
                lengths.append(len(fp))
        if not lengths:
            continue
        round_means.append(sum(lengths) / len(lengths))
    if not round_means:
        return None
    return sum(round_means) / len(round_means)


def level_thresholds_for_level(level: int) -> Tuple[Optional[float], Optional[float]]:
    """
    Retorna (max_avg_moves_up, min_avg_moves_down) para o nível atual.
    None em down para nível 1.
    """
    up_map = {
        1: 4.0,
        2: 5.0,
        3: 7.0,
        4: 10.0,
        5: 12.0,
        6: 14.0,
        7: 16.0,
        8: 18.0,
        9: 20.0,
        10: 22.0,
    }
    down_map = {
        2: 20.0,
        3: 20.0,
        4: 20.0,
        5: 22.0,
        6: 24.0,
        7: 26.0,
        8: 28.0,
        9: 30.0,
        10: 32.0,
    }
    mx = up_map.get(level)
    mn = down_map.get(level) if level >= 2 else None
    return mx, mn
