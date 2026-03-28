"""Dependências FastAPI para autorização por papel."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status

from app.core.roles import ROLE_ADMIN, ROLE_PROFESSOR, ROLE_ALUNO, STAFF_ROLES
from app.routes.auth import TokenData, get_current_user


def require_roles(*allowed_roles: str):
    """Retorna uma dependência que exige um dos papéis informados."""

    allowed = frozenset(allowed_roles)

    async def role_checker(
        current_user: TokenData = Depends(get_current_user),
    ) -> TokenData:
        if current_user.user_type not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissão negada",
            )
        return current_user

    return role_checker


async def require_staff_user(
    current_user: TokenData = Depends(get_current_user),
) -> TokenData:
    if current_user.user_type not in STAFF_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administrador ou professor",
        )
    return current_user


async def require_admin_user(
    current_user: TokenData = Depends(get_current_user),
) -> TokenData:
    if current_user.user_type != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administrador",
        )
    return current_user


async def require_aluno_or_staff(
    current_user: TokenData = Depends(get_current_user),
) -> TokenData:
    """Qualquer usuário autenticado com papel conhecido (todos os papéis do sistema)."""
    if current_user.user_type not in (ROLE_ADMIN, ROLE_PROFESSOR, ROLE_ALUNO):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Papel de usuário inválido",
        )
    return current_user


def assert_self_or_staff(current_user: TokenData, target_user_id: int) -> None:
    """Aluno só acessa o próprio user_id; staff acessa qualquer um."""
    if current_user.user_type in STAFF_ROLES:
        return
    if current_user.user_id == target_user_id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Permissão negada",
    )
