"""
Regras e classificação para a atividade «Senha forte» (senha fictícia).
Inclui rodadas (R1 base, R2 letras específicas, R3 dígitos/símbolos específicos).
"""

from __future__ import annotations
import hashlib
from typing import Any, Dict, List, Optional, Tuple
import random

ASCII_SYMBOL_CHARS = frozenset("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~")

DEFAULT_LETTER_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
DEFAULT_DIGIT_POOL = "0123456789"


def char_category(ch: str) -> Optional[str]:
    if len(ch) != 1:
        return None
    if ch == " ":
        return "space"
    if ch.isupper() and "A" <= ch <= "Z":
        return "upper"
    if ch.islower() and "a" <= ch <= "z":
        return "lower"
    if ch.isdigit():
        return "number"
    if ch in ASCII_SYMBOL_CHARS:
        return "symbol"
    return None


def clamp_specificity_count(raw: Any) -> int:
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return 1
    return max(1, min(3, n))


def default_symbol_pool_str() -> str:
    return "".join(sorted(ASCII_SYMBOL_CHARS))


def round3_digit_symbol_lists(
    specificity_count: int,
    rng: random.Random,
    digit_pool: str,
    symbol_pool: str,
) -> Tuple[List[str], List[str]]:
    """N=1: um dígito. N=2: um dígito + um símbolo. N=3: dois dígitos + um símbolo."""
    n = clamp_specificity_count(specificity_count)
    digits = [c for c in digit_pool if c.isdigit()]
    symbols = [c for c in symbol_pool if c in ASCII_SYMBOL_CHARS]
    if not digits:
        digits = list(DEFAULT_DIGIT_POOL)
    if not symbols:
        symbols = list(ASCII_SYMBOL_CHARS)

    if n == 1:
        return ([rng.choice(digits)], [])
    if n == 2:
        return ([rng.choice(digits)], [rng.choice(symbols)])
    if len(digits) >= 2:
        d_list = rng.sample(digits, 2)
    else:
        d_list = [rng.choice(digits), rng.choice(digits)]
    return (d_list, [rng.choice(symbols)])


def generate_senha_forte_challenge(
    level_params: Dict[str, Any],
    seed: int,
) -> Dict[str, Any]:
    """
    Gera desafio por sessão: letras (R2) e dígitos/símbolos (R3).
    `seed` deve ser estável por sessão (ex.: activity_session_id ou hash).
    """
    rng = random.Random(seed)
    n = clamp_specificity_count(level_params.get("specificity_count", 1))
    letter_pool = level_params.get("letter_pool") or DEFAULT_LETTER_POOL
    pool_letters = [c for c in letter_pool if char_category(c) in ("upper", "lower")]
    if len(pool_letters) < n:
        pool_letters = list(DEFAULT_LETTER_POOL)

    if len(pool_letters) >= n:
        r2 = rng.sample(pool_letters, n)
    else:
        r2 = [rng.choice(pool_letters) for _ in range(n)]

    digit_pool = level_params.get("digit_pool") or DEFAULT_DIGIT_POOL
    symbol_pool = level_params.get("symbol_pool") or default_symbol_pool_str()
    d_list, s_list = round3_digit_symbol_lists(n, rng, digit_pool, symbol_pool)

    return {
        "round2_letters": r2,
        "round3_digits": d_list,
        "round3_symbols": s_list,
    }


def challenge_seed_from_session(activity_session_id: int, user_id: int) -> int:
    h = hashlib.sha256(
        f"senha_forte:{activity_session_id}:{user_id}".encode("utf-8")
    ).digest()
    return int.from_bytes(h[:8], "big")


def get_rounds_total(level_params: Dict[str, Any]) -> int:
    """Sem `rounds_total` no JSON = modo antigo (1 rodada)."""
    if "rounds_total" not in level_params:
        return 1
    try:
        r = int(level_params.get("rounds_total", 1))
    except (TypeError, ValueError):
        return 1
    return max(1, min(10, r))


def is_multi_round(level_params: Dict[str, Any]) -> bool:
    return get_rounds_total(level_params) >= 2


def validate_password_against_level_params(  # noqa: C901
    level_params: Dict[str, Any],
    password: str,
    password_confirm: Optional[str] = None,
) -> Tuple[bool, str]:
    if password is None:
        password = ""
    min_length = int(level_params.get("min_length", 8))
    require_upper = bool(level_params.get("require_uppercase", True))
    require_lower = bool(level_params.get("require_lowercase", True))
    require_digit = bool(level_params.get("require_digit", False))
    require_symbol = bool(level_params.get("require_symbol", False))
    require_confirm = bool(level_params.get("require_password_confirmation", False))
    confirm_must_match = bool(level_params.get("confirmation_must_match", True))

    if len(password) < min_length:
        return False, f"Mínimo de {min_length} caracteres."

    has_upper = any("A" <= c <= "Z" for c in password)
    has_lower = any("a" <= c <= "z" for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_symbol = any(c in ASCII_SYMBOL_CHARS for c in password)

    if require_upper and not has_upper:
        return False, "Inclua pelo menos uma letra maiúscula (A–Z)."
    if require_lower and not has_lower:
        return False, "Inclua pelo menos uma letra minúscula (a–z)."
    if require_digit and not has_digit:
        return False, "Inclua pelo menos um número."
    if require_symbol and not has_symbol:
        return False, "Inclua pelo menos um símbolo permitido."

    for c in password:
        if char_category(c) is None:
            return (
                False,
                "Use apenas letras A–Z, números, espaço ou símbolos permitidos.",
            )

    if require_confirm:
        pc = password_confirm if password_confirm is not None else ""
        if confirm_must_match and pc != password:
            return False, "A confirmação deve coincidir com a senha."

    return True, "ok"


def validate_password_for_round(  # noqa: C901
    level_params: Dict[str, Any],
    challenge: Dict[str, Any],
    round_num: int,
    password: str,
    password_confirm: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Valida a senha para a rodada `round_num` (1-based).
    Confirmação só na última rodada (round_num == rounds_total).
    """
    rounds_total = get_rounds_total(level_params)
    if round_num < 1 or round_num > rounds_total:
        return False, "Rodada inválida."
    lp = dict(level_params)
    if round_num < rounds_total:
        lp["require_password_confirmation"] = False

    ok, msg = validate_password_against_level_params(
        lp,
        password,
        password_confirm if round_num >= rounds_total else None,
    )
    if not ok:
        return False, msg

    if rounds_total < 2 or round_num < 2:
        return True, "ok"

    letters = challenge.get("round2_letters") or []
    for ch in letters:
        if ch not in password:
            return False, f"Inclua o carácter obrigatório «{ch}»."

    if round_num < 3:
        return True, "ok"

    for d in challenge.get("round3_digits") or []:
        if d not in password:
            return False, f"Inclua o dígito obrigatório «{d}»."
    for s in challenge.get("round3_symbols") or []:
        if s not in password:
            return False, f"Inclua o símbolo obrigatório «{s}»."

    return True, "ok"


def extract_duration_ms_from_results(results: Dict[str, Any]) -> Optional[int]:
    raw = results.get("duration_primary_field_keydown_ms")
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def median(values: List[float]) -> Optional[float]:
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    mid = n // 2
    if n % 2:
        return float(s[mid])
    return (s[mid - 1] + s[mid]) / 2.0


def finalize_senha_forte_results(
    results: Dict[str, Any],
    level_params: Dict[str, Any],
    challenge: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Remove campos transitórios e define validation_passed no servidor.
    Se existir modo multi-rodada, valida a última rodada com challenge (do servidor).
    """
    raw = dict(results)
    pw = raw.pop("_password", "") or ""
    pc = raw.pop("_confirm", None)

    ch = challenge if challenge is not None else raw.get("challenge")
    rounds_total = get_rounds_total(level_params)

    if int(raw.get("senha_forte_version", 0)) >= 2 and rounds_total >= 2 and ch:
        ok, _msg = validate_password_for_round(level_params, ch, rounds_total, pw, pc)
    else:
        ok, _msg = validate_password_against_level_params(level_params, pw, pc)

    raw["validation_passed"] = ok
    return raw
