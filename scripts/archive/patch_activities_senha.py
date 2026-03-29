from pathlib import Path
p = Path("app/routes/activities.py")
t = p.read_text(encoding="utf-8")
if "get_senha_forte_params" in t:
    print("activities senha_forte already")
    raise SystemExit(0)
append = '''

class StrongPasswordParams(BaseModel):
    """Parâmetros de nível expostos ao cliente (senha fictícia)."""
    min_length: int = 4
    require_uppercase: bool = True
    require_lowercase: bool = True
    require_digit: bool = False
    require_symbol: bool = False
    require_password_confirmation: bool = False
    confirmation_must_match: bool = True
    symbol_class: str = "ascii_punctuation"


class SenhaForteValidateBody(BaseModel):
    activity_id: int
    password: str = ""
    password_confirm: Optional[str] = None


@router.get("/senha-forte/params", response_model=StrongPasswordParams)
async def get_senha_forte_params(
    activity_id: Optional[int] = None,
    current_user: Optional[TokenData] = Depends(get_current_user),
):
    default_params = StrongPasswordParams()
    if not activity_id:
        return default_params
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária para parâmetros personalizados desta atividade",
        )
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT ap.level_params
                FROM user_activity_params uap
                JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                WHERE uap.user_id = %s
                    AND ap.activity_id = %s
                    AND uap.active = TRUE
                    AND ap.active = TRUE
                ORDER BY uap.initiated_at DESC
                LIMIT 1
                """,
                (current_user.user_id, activity_id),
            )
            result = cur.fetchone()
            if result and result["level_params"]:
                params = result["level_params"]
                return StrongPasswordParams(
                    min_length=int(params.get("min_length", default_params.min_length)),
                    require_uppercase=bool(
                        params.get("require_uppercase", default_params.require_uppercase)
                    ),
                    require_lowercase=bool(
                        params.get("require_lowercase", default_params.require_lowercase)
                    ),
                    require_digit=bool(
                        params.get("require_digit", default_params.require_digit)
                    ),
                    require_symbol=bool(
                        params.get("require_symbol", default_params.require_symbol)
                    ),
                    require_password_confirmation=bool(
                        params.get(
                            "require_password_confirmation",
                            default_params.require_password_confirmation,
                        )
                    ),
                    confirmation_must_match=bool(
                        params.get(
                            "confirmation_must_match",
                            default_params.confirmation_must_match,
                        )
                    ),
                    symbol_class=str(
                        params.get("symbol_class", default_params.symbol_class)
                    ),
                )
    except Exception as e:
        logger.warning(
            "Erro ao buscar parâmetros senha forte: %s. Retornando padrão.", str(e)
        )
    finally:
        if conn:
            conn.close()
    return default_params


@router.post("/senha-forte/validate")
async def post_senha_forte_validate(
    body: SenhaForteValidateBody,
    current_user: TokenData = Depends(get_current_user),
):
    from app.core.strong_password import validate_password_against_level_params

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT ap.level_params
                FROM user_activity_params uap
                JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id
                WHERE uap.user_id = %s
                    AND ap.activity_id = %s
                    AND uap.active = TRUE
                    AND ap.active = TRUE
                ORDER BY uap.initiated_at DESC
                LIMIT 1
                """,
                (current_user.user_id, body.activity_id),
            )
            result = cur.fetchone()
            if not result or not result.get("level_params"):
                raise HTTPException(
                    status_code=400,
                    detail="Parâmetros de nível não encontrados para esta atividade.",
                )
            lp = result["level_params"]
            if isinstance(lp, str):
                import json as _json
                lp = _json.loads(lp)
    finally:
        if conn:
            conn.close()
    ok, msg = validate_password_against_level_params(
        lp, body.password, body.password_confirm
    )
    return {"valid": ok, "message": msg}
'''
# fix imports - need HTTPException status
if "from fastapi import APIRouter, Depends, HTTPException, status" not in t:
    t = t.replace(
        "from fastapi import APIRouter, Depends, HTTPException",
        "from fastapi import APIRouter, Depends, HTTPException, status",
    )
p.write_text(t + append, encoding="utf-8")
print("appended activities senha_forte")
