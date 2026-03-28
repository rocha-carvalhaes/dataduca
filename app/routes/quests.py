"""Rotas de quests: sequências de atividades e progresso do aluno."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, List, Optional

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
    created_by: int
    created_at: datetime
    updated_at: datetime
    steps: List[QuestStepOut]


class UserProgressOut(BaseModel):
    user_quest_progress_id: int
    quest_id: int
    status: str
    completed_activity_ids: List[int]
    started_at: datetime
    completed_at: Optional[datetime] = None


class QuestDetailWithProgress(BaseModel):
    quest: QuestDetail
    progress: Optional[UserProgressOut] = None


class CompleteStepBody(BaseModel):
    activity_id: int


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


@router.get("/", response_model=List[QuestListItem])
async def list_quests(_: TokenData = Depends(require_aluno_or_staff)):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT q.quest_id, q.quest_name, q.quest_description, q.enforce_sequence,
                       COUNT(qs.quest_step_id)::int AS step_count
                FROM quests q
                LEFT JOIN quest_steps qs ON qs.quest_id = q.quest_id
                GROUP BY q.quest_id, q.quest_name, q.quest_description, q.enforce_sequence
                ORDER BY q.updated_at DESC
                """
            )
            rows = cur.fetchall()
            return [
                QuestListItem(
                    quest_id=r["quest_id"],
                    quest_name=r["quest_name"],
                    quest_description=r["quest_description"],
                    enforce_sequence=r["enforce_sequence"],
                    step_count=r["step_count"] or 0,
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
                       enforce_sequence, created_by, created_at, updated_at
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
                created_by=q["created_by"],
                created_at=q["created_at"],
                updated_at=q["updated_at"],
                steps=steps,
            )

            progress_out: Optional[UserProgressOut] = None
            cur.execute(
                """
                SELECT user_quest_progress_id, quest_id, status, completed_activity_ids,
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
                    completed_activity_ids=_parse_completed_ids(pr["completed_activity_ids"]),
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
        raise HTTPException(status_code=400, detail="A quest precisa de pelo menos um passo")
    orders = [s.step_order for s in steps]
    if len(set(orders)) != len(orders):
        raise HTTPException(status_code=400, detail="step_order duplicado")
    aids = [s.activity_id for s in steps]
    if len(set(aids)) != len(aids):
        raise HTTPException(status_code=400, detail="Atividade repetida na mesma quest")


@router.post("/", response_model=QuestDetail)
async def create_quest(
    body: QuestCreate,
    user: TokenData = Depends(require_staff_user),
):
    _validate_steps(body.steps)
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO quests (quest_name, quest_description, quest_objective,
                    enforce_sequence, created_by, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING quest_id
                """,
                (
                    body.quest_name,
                    body.quest_description,
                    body.quest_objective,
                    True,  # sequência fixa por quest_steps; mapa/gamificação no futuro
                    user.user_id,
                ),
            )
            quest_id = cur.fetchone()["quest_id"]

            for s in body.steps:
                cur.execute(
                    """
                    INSERT INTO quest_steps (quest_id, activity_id, step_order)
                    VALUES (%s, %s, %s)
                    """,
                    (quest_id, s.activity_id, s.step_order),
                )

            conn.commit()

            cur.execute(
                """
                SELECT quest_id, quest_name, quest_description, quest_objective,
                       enforce_sequence, created_by, created_at, updated_at
                FROM quests WHERE quest_id = %s
                """,
                (quest_id,),
            )
            q = cur.fetchone()
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
            return QuestDetail(
                quest_id=q["quest_id"],
                quest_name=q["quest_name"],
                quest_description=q["quest_description"],
                quest_objective=q["quest_objective"],
                enforce_sequence=q["enforce_sequence"],
                created_by=q["created_by"],
                created_at=q["created_at"],
                updated_at=q["updated_at"],
                steps=steps,
            )
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
    _validate_steps(body.steps)
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT quest_id FROM quests WHERE quest_id = %s", (quest_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Quest não encontrada")

            cur.execute(
                """
                UPDATE quests SET
                    quest_name = %s,
                    quest_description = %s,
                    quest_objective = %s,
                    enforce_sequence = TRUE,
                    updated_at = NOW()
                WHERE quest_id = %s
                """,
                (
                    body.quest_name,
                    body.quest_description,
                    body.quest_objective,
                    quest_id,
                ),
            )
            cur.execute("DELETE FROM quest_steps WHERE quest_id = %s", (quest_id,))
            for s in body.steps:
                cur.execute(
                    """
                    INSERT INTO quest_steps (quest_id, activity_id, step_order)
                    VALUES (%s, %s, %s)
                    """,
                    (quest_id, s.activity_id, s.step_order),
                )

            conn.commit()

            cur.execute(
                """
                SELECT quest_id, quest_name, quest_description, quest_objective,
                       enforce_sequence, created_by, created_at, updated_at
                FROM quests WHERE quest_id = %s
                """,
                (quest_id,),
            )
            q = cur.fetchone()
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
            return QuestDetail(
                quest_id=q["quest_id"],
                quest_name=q["quest_name"],
                quest_description=q["quest_description"],
                quest_objective=q["quest_objective"],
                enforce_sequence=q["enforce_sequence"],
                created_by=q["created_by"],
                created_at=q["created_at"],
                updated_at=q["updated_at"],
                steps=steps,
            )
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("update_quest: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.delete("/{quest_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quest(quest_id: int, _: TokenData = Depends(require_staff_user)):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM quests WHERE quest_id = %s RETURNING quest_id", (quest_id,))
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
                INSERT INTO user_quest_progress (user_id, quest_id, status, completed_activity_ids, started_at)
                VALUES (%s, %s, 'in_progress', '[]'::jsonb, NOW())
                ON CONFLICT (user_id, quest_id) DO UPDATE SET
                    status = 'in_progress',
                    completed_activity_ids = '[]'::jsonb,
                    completed_at = NULL,
                    started_at = NOW()
                RETURNING user_quest_progress_id, quest_id, status, completed_activity_ids, started_at, completed_at
                """,
                (user.user_id, quest_id),
            )
            row = cur.fetchone()
            conn.commit()
            return UserProgressOut(
                user_quest_progress_id=row["user_quest_progress_id"],
                quest_id=row["quest_id"],
                status=row["status"],
                completed_activity_ids=_parse_completed_ids(row["completed_activity_ids"]),
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
            cur.execute(
                """
                SELECT quest_id FROM quests WHERE quest_id = %s
                """,
                (quest_id,),
            )
            quest_row = cur.fetchone()
            if not quest_row:
                raise HTTPException(status_code=404, detail="Quest não encontrada")

            # Sempre seguir quest_steps em ordem; no futuro (mapa/gamificação) pode haver exceções.
            step_rows = _fetch_steps_with_activities(cur, quest_id)
            if not step_rows:
                raise HTTPException(status_code=400, detail="Quest sem passos")

            activity_ids_in_quest = {r["activity_id"] for r in step_rows}
            if body.activity_id not in activity_ids_in_quest:
                raise HTTPException(status_code=400, detail="Atividade não pertence a esta quest")

            cur.execute(
                """
                SELECT user_quest_progress_id, status, completed_activity_ids
                FROM user_quest_progress
                WHERE user_id = %s AND quest_id = %s
                FOR UPDATE
                """,
                (user.user_id, quest_id),
            )
            pr = cur.fetchone()
            if not pr:
                raise HTTPException(
                    status_code=400,
                    detail="Inicie a quest antes de registrar conclusão de passo",
                )

            completed = set(_parse_completed_ids(pr["completed_activity_ids"]))
            if body.activity_id in completed:
                cur.execute(
                    """
                    SELECT user_quest_progress_id, quest_id, status, completed_activity_ids,
                           started_at, completed_at
                    FROM user_quest_progress
                    WHERE user_id = %s AND quest_id = %s
                    """,
                    (user.user_id, quest_id),
                )
                row = cur.fetchone()
                conn.commit()
                return UserProgressOut(
                    user_quest_progress_id=row["user_quest_progress_id"],
                    quest_id=row["quest_id"],
                    status=row["status"],
                    completed_activity_ids=_parse_completed_ids(row["completed_activity_ids"]),
                    started_at=row["started_at"],
                    completed_at=row["completed_at"],
                )

            ordered = sorted(step_rows, key=lambda x: x["step_order"])
            next_expected = None
            for r in ordered:
                if r["activity_id"] not in completed:
                    next_expected = r["activity_id"]
                    break
            if next_expected is None:
                raise HTTPException(status_code=400, detail="Todos os passos já foram concluídos")
            if body.activity_id != next_expected:
                raise HTTPException(
                    status_code=400,
                    detail="Conclua os passos na ordem definida em quest_steps",
                )

            completed.add(body.activity_id)
            completed_list = sorted(completed)
            all_done = activity_ids_in_quest <= completed

            new_status = "completed" if all_done else "in_progress"
            completed_at = datetime.utcnow() if all_done else None

            cur.execute(
                """
                UPDATE user_quest_progress SET
                    completed_activity_ids = %s::jsonb,
                    status = %s,
                    completed_at = COALESCE(%s, completed_at)
                WHERE user_quest_progress_id = %s
                RETURNING user_quest_progress_id, quest_id, status, completed_activity_ids, started_at, completed_at
                """,
                (
                    Json(completed_list),
                    new_status,
                    completed_at,
                    pr["user_quest_progress_id"],
                ),
            )
            row = cur.fetchone()
            conn.commit()
            return UserProgressOut(
                user_quest_progress_id=row["user_quest_progress_id"],
                quest_id=row["quest_id"],
                status=row["status"],
                completed_activity_ids=_parse_completed_ids(row["completed_activity_ids"]),
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
        logger.error("complete_step: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()
