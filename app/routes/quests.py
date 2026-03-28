"""Rotas de quests: sequências de atividades e progresso do aluno."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from psycopg2.extras import Json, RealDictCursor

from app.deps.authz import require_aluno_or_staff, require_staff_user
from app.routes.auth import TokenData, get_db_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quests", tags=["Quests"])


# --- Pydantic ---


class QuestStepInput(BaseModel):
    activity_id: int
    step_order: int = Field(ge=1)


class QuestCreate(BaseModel):
    quest_name: str
    quest_description: Optional[str] = None
    quest_objective: Optional[str] = None
    enforce_sequence: bool = True
    steps: List[QuestStepInput]
    # Se informado, cria nova quest e marca a anterior como substituída (nova versão).
    fork_from_quest_id: Optional[int] = None


class QuestUpdate(BaseModel):
    quest_name: str
    quest_description: Optional[str] = None
    quest_objective: Optional[str] = None
    enforce_sequence: bool = True
    steps: List[QuestStepInput]


class QuestListItem(BaseModel):
    quest_id: int
    quest_name: str
    quest_description: Optional[str] = None
    enforce_sequence: bool
    step_count: int
    superseded_by_quest_id: Optional[int] = None


class QuestStepOut(BaseModel):
    quest_step_id: int
    activity_id: int
    step_order: int
    activity_name: str
    activity_type: str


class QuestDetail(BaseModel):
    quest_id: int
    quest_name: str
    quest_description: Optional[str] = None
    quest_objective: Optional[str] = None
    enforce_sequence: bool
    forked_from_quest_id: Optional[int] = None
    superseded_by_quest_id: Optional[int] = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    steps: List[QuestStepOut]


class UserProgressOut(BaseModel):
    user_quest_progress_id: int
    quest_id: int
    status: str
    completed_quest_step_ids: List[int]
    started_at: datetime
    completed_at: Optional[datetime] = None


class QuestDetailWithProgress(BaseModel):
    quest: QuestDetail
    progress: Optional[UserProgressOut] = None


class CompleteStepBody(BaseModel):
    quest_step_id: int


def _parse_completed_ids(raw: Any) -> List[int]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [int(x) for x in raw]
    if isinstance(raw, str):
        return [int(x) for x in json.loads(raw)]
    return [int(x) for x in raw]


def _fetch_steps_with_activities(cur, quest_id: int) -> List[dict]:
    cur.execute(
        """
        SELECT qs.quest_step_id, qs.activity_id, qs.step_order,
               a.activity_name, a.activity_type
        FROM quest_steps qs
        JOIN activities a ON a.activity_id = qs.activity_id
        WHERE qs.quest_id = %s
        ORDER BY qs.step_order ASC
        """,
        (quest_id,),
    )
    return cur.fetchall()


def _quest_step_rows_to_out(step_rows: List[dict]) -> List[QuestStepOut]:
    return [
        QuestStepOut(
            quest_step_id=r["quest_step_id"],
            activity_id=r["activity_id"],
            step_order=r["step_order"],
            activity_name=r["activity_name"],
            activity_type=r["activity_type"],
        )
        for r in step_rows
    ]


def _load_quest_detail(cur, quest_id: int) -> QuestDetail:
    cur.execute(
        """
        SELECT quest_id, quest_name, quest_description, quest_objective,
               enforce_sequence, forked_from_quest_id, superseded_by_quest_id,
               created_by, created_at, updated_at
        FROM quests WHERE quest_id = %s
        """,
        (quest_id,),
    )
    q = cur.fetchone()
    step_rows = _fetch_steps_with_activities(cur, quest_id)
    steps = _quest_step_rows_to_out(step_rows)
    return QuestDetail(
        quest_id=q["quest_id"],
        quest_name=q["quest_name"],
        quest_description=q["quest_description"],
        quest_objective=q["quest_objective"],
        enforce_sequence=q["enforce_sequence"],
        forked_from_quest_id=q.get("forked_from_quest_id"),
        superseded_by_quest_id=q.get("superseded_by_quest_id"),
        created_by=q["created_by"],
        created_at=q["created_at"],
        updated_at=q["updated_at"],
        steps=steps,
    )


def _validate_fork_parent_for_insert(cur, fork_from: Optional[int]) -> None:
    if fork_from is None:
        return
    cur.execute(
        """
        SELECT quest_id, superseded_by_quest_id FROM quests
        WHERE quest_id = %s
        FOR UPDATE
        """,
        (fork_from,),
    )
    parent = cur.fetchone()
    if not parent:
        raise HTTPException(
            status_code=404, detail="Quest origem (fork) não encontrada"
        )
    if parent["superseded_by_quest_id"] is not None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Esta versão já foi substituída; abra a quest atual na lista "
                "para criar outra versão."
            ),
        )


def _insert_new_quest_row(
    cur, body: QuestCreate, user_id: int, fork_from: Optional[int]
) -> int:
    cur.execute(
        """
        INSERT INTO quests (quest_name, quest_description, quest_objective,
            enforce_sequence, created_by, created_at, updated_at,
            forked_from_quest_id, superseded_by_quest_id)
        VALUES (%s, %s, %s, TRUE, %s, NOW(), NOW(), %s, NULL)
        RETURNING quest_id
        """,
        (
            body.quest_name,
            body.quest_description,
            body.quest_objective,
            user_id,
            fork_from,
        ),
    )
    return cur.fetchone()["quest_id"]


def _insert_quest_step_rows(cur, quest_id: int, steps: List[QuestStepInput]) -> None:
    for s in steps:
        cur.execute(
            """
            INSERT INTO quest_steps (quest_id, activity_id, step_order)
            VALUES (%s, %s, %s)
            """,
            (quest_id, s.activity_id, s.step_order),
        )


def _supersede_fork_parent(cur, conn, new_quest_id: int, fork_from: int) -> None:
    cur.execute(
        """
        UPDATE quests SET superseded_by_quest_id = %s, updated_at = NOW()
        WHERE quest_id = %s AND superseded_by_quest_id IS NULL
        """,
        (new_quest_id, fork_from),
    )
    if cur.rowcount != 1:
        conn.rollback()
        raise HTTPException(
            status_code=409,
            detail="Não foi possível registrar a nova versão; tente novamente.",
        )


def _user_progress_out_from_row(row: Dict[str, Any]) -> UserProgressOut:
    return UserProgressOut(
        user_quest_progress_id=row["user_quest_progress_id"],
        quest_id=row["quest_id"],
        status=row["status"],
        completed_quest_step_ids=_parse_completed_ids(row["completed_quest_step_ids"]),
        started_at=row["started_at"],
        completed_at=row["completed_at"],
    )


def _fetch_progress_snapshot_after_commit(
    cur, conn, user_id: int, quest_id: int
) -> UserProgressOut:
    cur.execute(
        """
        SELECT user_quest_progress_id, quest_id, status, completed_quest_step_ids,
               started_at, completed_at
        FROM user_quest_progress
        WHERE user_id = %s AND quest_id = %s
        """,
        (user_id, quest_id),
    )
    row = cur.fetchone()
    conn.commit()
    return _user_progress_out_from_row(row)


def _next_incomplete_quest_step_id(
    ordered: List[dict], completed: set
) -> Optional[int]:
    for r in ordered:
        if r["quest_step_id"] not in completed:
            return r["quest_step_id"]
    return None


def _assert_step_completion_order(
    body: CompleteStepBody, ordered: List[dict], completed: set
) -> None:
    next_expected = _next_incomplete_quest_step_id(ordered, completed)
    if next_expected is None:
        raise HTTPException(
            status_code=400, detail="Todos os passos já foram concluídos"
        )
    if body.quest_step_id != next_expected:
        raise HTTPException(
            status_code=400,
            detail="Conclua os passos na ordem definida em quest_steps",
        )


def _complete_step_transaction(
    cur,
    conn,
    quest_id: int,
    body: CompleteStepBody,
    user_id: int,
) -> UserProgressOut:
    cur.execute(
        """
        SELECT quest_id FROM quests WHERE quest_id = %s
        """,
        (quest_id,),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Quest não encontrada")

    step_rows = _fetch_steps_with_activities(cur, quest_id)
    if not step_rows:
        raise HTTPException(status_code=400, detail="Quest sem passos")

    step_ids_in_quest = {r["quest_step_id"] for r in step_rows}
    if body.quest_step_id not in step_ids_in_quest:
        raise HTTPException(status_code=400, detail="Passo não pertence a esta quest")

    cur.execute(
        """
        SELECT user_quest_progress_id, status, completed_quest_step_ids
        FROM user_quest_progress
        WHERE user_id = %s AND quest_id = %s
        FOR UPDATE
        """,
        (user_id, quest_id),
    )
    pr = cur.fetchone()
    if not pr:
        raise HTTPException(
            status_code=400,
            detail="Inicie a quest antes de registrar conclusão de passo",
        )

    completed = set(_parse_completed_ids(pr["completed_quest_step_ids"]))
    if body.quest_step_id in completed:
        return _fetch_progress_snapshot_after_commit(cur, conn, user_id, quest_id)

    ordered = sorted(step_rows, key=lambda x: x["step_order"])
    _assert_step_completion_order(body, ordered, completed)

    completed.add(body.quest_step_id)
    order_index = {r["quest_step_id"]: i for i, r in enumerate(ordered)}
    completed_list = sorted(completed, key=lambda x: order_index[x])
    all_done = len(completed) == len(ordered)

    return _persist_quest_step_completion(cur, conn, pr, completed_list, all_done)


def _persist_quest_step_completion(
    cur,
    conn,
    progress_row: dict,
    completed_list: List[int],
    all_done: bool,
) -> UserProgressOut:
    new_status = "completed" if all_done else "in_progress"
    completed_at = datetime.utcnow() if all_done else None
    cur.execute(
        """
        UPDATE user_quest_progress SET
            completed_quest_step_ids = %s::jsonb,
            status = %s,
            completed_at = COALESCE(%s, completed_at)
        WHERE user_quest_progress_id = %s
        RETURNING user_quest_progress_id, quest_id, status, completed_quest_step_ids, started_at, completed_at
        """,
        (
            Json(completed_list),
            new_status,
            completed_at,
            progress_row["user_quest_progress_id"],
        ),
    )
    row = cur.fetchone()
    conn.commit()
    return _user_progress_out_from_row(row)


@router.get("/", response_model=List[QuestListItem])
async def list_quests(user: TokenData = Depends(require_aluno_or_staff)):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Só versões atuais (não substituídas por fork); obsoletas ficam fora da lista.
            cur.execute("""
                SELECT q.quest_id, q.quest_name, q.quest_description, q.enforce_sequence,
                       q.superseded_by_quest_id,
                       COUNT(qs.quest_step_id)::int AS step_count
                FROM quests q
                LEFT JOIN quest_steps qs ON qs.quest_id = q.quest_id
                WHERE q.superseded_by_quest_id IS NULL
                GROUP BY q.quest_id, q.quest_name, q.quest_description, q.enforce_sequence,
                         q.superseded_by_quest_id
                ORDER BY q.updated_at DESC
                """)
            rows = cur.fetchall()
            return [
                QuestListItem(
                    quest_id=r["quest_id"],
                    quest_name=r["quest_name"],
                    quest_description=r["quest_description"],
                    enforce_sequence=r["enforce_sequence"],
                    step_count=r["step_count"] or 0,
                    superseded_by_quest_id=r["superseded_by_quest_id"],
                )
                for r in rows
            ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("list_quests: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.get("/{quest_id}", response_model=QuestDetailWithProgress)
async def get_quest(quest_id: int, user: TokenData = Depends(require_aluno_or_staff)):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT quest_id, quest_name, quest_description, quest_objective,
                       enforce_sequence, forked_from_quest_id, superseded_by_quest_id,
                       created_by, created_at, updated_at
                FROM quests WHERE quest_id = %s
                """,
                (quest_id,),
            )
            q = cur.fetchone()
            if not q:
                raise HTTPException(status_code=404, detail="Quest não encontrada")

            step_rows = _fetch_steps_with_activities(cur, quest_id)
            steps = [
                QuestStepOut(
                    quest_step_id=r["quest_step_id"],
                    activity_id=r["activity_id"],
                    step_order=r["step_order"],
                    activity_name=r["activity_name"],
                    activity_type=r["activity_type"],
                )
                for r in step_rows
            ]

            quest_detail = QuestDetail(
                quest_id=q["quest_id"],
                quest_name=q["quest_name"],
                quest_description=q["quest_description"],
                quest_objective=q["quest_objective"],
                enforce_sequence=q["enforce_sequence"],
                forked_from_quest_id=q.get("forked_from_quest_id"),
                superseded_by_quest_id=q.get("superseded_by_quest_id"),
                created_by=q["created_by"],
                created_at=q["created_at"],
                updated_at=q["updated_at"],
                steps=steps,
            )

            progress_out: Optional[UserProgressOut] = None
            cur.execute(
                """
                SELECT user_quest_progress_id, quest_id, status, completed_quest_step_ids,
                       started_at, completed_at
                FROM user_quest_progress
                WHERE user_id = %s AND quest_id = %s
                """,
                (user.user_id, quest_id),
            )
            pr = cur.fetchone()
            if pr:
                progress_out = UserProgressOut(
                    user_quest_progress_id=pr["user_quest_progress_id"],
                    quest_id=pr["quest_id"],
                    status=pr["status"],
                    completed_quest_step_ids=_parse_completed_ids(
                        pr["completed_quest_step_ids"]
                    ),
                    started_at=pr["started_at"],
                    completed_at=pr["completed_at"],
                )

            return QuestDetailWithProgress(quest=quest_detail, progress=progress_out)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_quest: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


def _validate_steps(steps: List[QuestStepInput]) -> None:
    if not steps:
        raise HTTPException(
            status_code=400, detail="A quest precisa de pelo menos um passo"
        )
    orders = [s.step_order for s in steps]
    if len(set(orders)) != len(orders):
        raise HTTPException(status_code=400, detail="step_order duplicado")


@router.post("/", response_model=QuestDetail)
async def create_quest(
    body: QuestCreate,
    user: TokenData = Depends(require_staff_user),
):
    _validate_steps(body.steps)
    fork_from = body.fork_from_quest_id
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            _validate_fork_parent_for_insert(cur, fork_from)
            quest_id = _insert_new_quest_row(cur, body, user.user_id, fork_from)
            _insert_quest_step_rows(cur, quest_id, body.steps)
            if fork_from is not None:
                _supersede_fork_parent(cur, conn, quest_id, fork_from)

            conn.commit()

            return _load_quest_detail(cur, quest_id)
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("create_quest: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.put("/{quest_id}", response_model=QuestDetail)
async def update_quest(
    quest_id: int,
    body: QuestUpdate,
    _: TokenData = Depends(require_staff_user),
):
    raise HTTPException(
        status_code=400,
        detail=(
            "Edição in-place desativada. Salve como nova versão pelo formulário "
            "(cria outra quest e mantém a anterior para quem já iniciou)."
        ),
    )


@router.delete("/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quest(quest_id: int, _: TokenData = Depends(require_staff_user)):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM quests WHERE quest_id = %s RETURNING quest_id", (quest_id,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Quest não encontrada")
            conn.commit()
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("delete_quest: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.post("/{quest_id}/start", response_model=UserProgressOut)
async def start_quest(quest_id: int, user: TokenData = Depends(require_aluno_or_staff)):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT quest_id FROM quests WHERE quest_id = %s", (quest_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Quest não encontrada")

            cur.execute(
                """
                INSERT INTO user_quest_progress (user_id, quest_id, status, completed_quest_step_ids, started_at)
                VALUES (%s, %s, 'in_progress', '[]'::jsonb, NOW())
                ON CONFLICT (user_id, quest_id) DO UPDATE SET
                    status = 'in_progress',
                    completed_quest_step_ids = '[]'::jsonb,
                    completed_at = NULL,
                    started_at = NOW()
                RETURNING user_quest_progress_id, quest_id, status, completed_quest_step_ids, started_at, completed_at
                """,
                (user.user_id, quest_id),
            )
            row = cur.fetchone()
            conn.commit()
            return UserProgressOut(
                user_quest_progress_id=row["user_quest_progress_id"],
                quest_id=row["quest_id"],
                status=row["status"],
                completed_quest_step_ids=_parse_completed_ids(
                    row["completed_quest_step_ids"]
                ),
                started_at=row["started_at"],
                completed_at=row["completed_at"],
            )
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("start_quest: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.post("/{quest_id}/complete-step", response_model=UserProgressOut)
async def complete_step(
    quest_id: int,
    body: CompleteStepBody,
    user: TokenData = Depends(require_aluno_or_staff),
):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            return _complete_step_transaction(cur, conn, quest_id, body, user.user_id)
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("complete_step: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()
