"""Papéis canônicos (user_type no banco e no JWT)."""

ROLE_ADMIN = "administrador"
ROLE_PROFESSOR = "professor"
ROLE_ALUNO = "aluno"

ALLOWED_USER_TYPES = frozenset({ROLE_ADMIN, ROLE_PROFESSOR, ROLE_ALUNO})

STAFF_ROLES = frozenset({ROLE_ADMIN, ROLE_PROFESSOR})


def is_staff(user_type: str) -> bool:
    return user_type in STAFF_ROLES


def is_admin(user_type: str) -> bool:
    return user_type == ROLE_ADMIN
