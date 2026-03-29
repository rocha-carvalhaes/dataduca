"""Testes unitários para app.core.strong_password (sem I/O)."""

import pytest

from app.core.strong_password import (
    char_category,
    finalize_senha_forte_results,
    generate_senha_forte_challenge,
    median,
    validate_password_against_level_params,
    validate_password_for_round,
)


def test_char_category_basic():
    assert char_category("A") == "upper"
    assert char_category("z") == "lower"
    assert char_category("5") == "number"
    assert char_category("!") == "symbol"
    assert char_category(" ") == "space"
    assert char_category("\t") is None


@pytest.mark.parametrize(
    "password,ok",
    [
        ("Abcd1234", True),
        ("Abcd", False),
    ],
)
def test_validate_min_length(password, ok):
    lp = {"min_length": 8, "require_uppercase": True, "require_lowercase": True}
    valid, _msg = validate_password_against_level_params(lp, password, None)
    assert valid is ok


def test_validate_requires_confirmation():
    lp = {
        "min_length": 4,
        "require_uppercase": False,
        "require_lowercase": False,
        "require_password_confirmation": True,
        "confirmation_must_match": True,
    }
    assert validate_password_against_level_params(lp, "Ab12", "xx")[0] is False
    assert validate_password_against_level_params(lp, "Ab12", "Ab12")[0] is True


def test_finalize_sets_validation_passed():
    lp = {"min_length": 4, "require_uppercase": True, "require_lowercase": True}
    out = finalize_senha_forte_results(
        {
            "attempts_in_session": 1,
            "duration_primary_field_keydown_ms": 100,
            "events": [],
            "_password": "Abcd",
            "_confirm": "",
        },
        lp,
    )
    assert "_password" not in out
    assert "_confirm" not in out
    assert out["validation_passed"] is True
    assert out["attempts_in_session"] == 1


def test_finalize_invalid_password():
    lp = {"min_length": 10, "require_uppercase": True, "require_lowercase": True}
    out = finalize_senha_forte_results(
        {"_password": "short", "_confirm": ""},
        lp,
    )
    assert out["validation_passed"] is False


def test_median_odd_even():
    assert median([3.0, 1.0, 2.0]) == 2.0
    assert median([1.0, 2.0, 3.0, 4.0]) == 2.5
    assert median([]) is None


def test_generate_challenge_and_rounds():
    lp = {"specificity_count": 2, "rounds_total": 3}
    ch = generate_senha_forte_challenge(lp, seed=42)
    assert len(ch["round2_letters"]) == 2
    assert len(ch["round3_digits"]) == 1 and len(ch["round3_symbols"]) == 1


def test_validate_round2_and_round3():
    lp = {
        "min_length": 6,
        "require_uppercase": True,
        "require_lowercase": True,
        "require_digit": False,
        "require_symbol": False,
        "rounds_total": 3,
        "specificity_count": 1,
    }
    ch = {
        "round2_letters": ["X"],
        "round3_digits": ["1"],
        "round3_symbols": [],
    }
    assert validate_password_for_round(lp, ch, 1, "Abcdef", None)[0] is True
    assert validate_password_for_round(lp, ch, 2, "Abcdef", None)[0] is False
    assert validate_password_for_round(lp, ch, 2, "AbcdefX", None)[0] is True
    assert validate_password_for_round(lp, ch, 3, "AbcdefX1", None)[0] is True


def test_finalize_multi_round():
    lp = {
        "min_length": 6,
        "require_uppercase": True,
        "require_lowercase": True,
        "require_digit": False,
        "require_symbol": False,
        "rounds_total": 3,
        "specificity_count": 1,
    }
    ch = {
        "round2_letters": ["X"],
        "round3_digits": ["1"],
        "round3_symbols": [],
    }
    out = finalize_senha_forte_results(
        {
            "senha_forte_version": 2,
            "_password": "AbcdefX1",
            "_confirm": "",
        },
        lp,
        challenge=ch,
    )
    assert out["validation_passed"] is True
