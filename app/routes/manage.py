from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from psycopg2.extras import RealDictCursor
import logging

from app.routes.auth import get_current_user, TokenData, get_db_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/manage", tags=["Manage"])

ALLOWED_TABLES = {
    "users": {
        "label": "Usuários",
        "query": "SELECT user_id, user_name, user_type, created_at FROM users",
        "order_by": "created_at DESC",
    },
    "user_sessions": {
        "label": "Sessões de Usuários",
        "query": (
            "SELECT us.user_session_id, us.user_id, u.user_name, "
            "us.initiated_at, us.ended_at "
            "FROM user_sessions us "
            "JOIN users u ON us.user_id = u.user_id"
        ),
        "order_by": "us.initiated_at DESC",
    },
    "activities": {
        "label": "Atividades",
        "query": (
            "SELECT activity_id, activity_name, activity_description, "
            "activity_objective, activity_type, activity_icon, "
            "activity_version, updated_at FROM activities"
        ),
        "order_by": "updated_at DESC",
    },
    "activity_sessions": {
        "label": "Sessões de Atividades",
        "query": (
            "SELECT asess.activity_session_id, asess.user_session_id, "
            "u.user_name, asess.activity_id, a.activity_name, "
            "asess.results, asess.initiated_at, asess.ended_at "
            "FROM activity_sessions asess "
            "JOIN user_sessions us ON asess.user_session_id = us.user_session_id "
            "JOIN users u ON us.user_id = u.user_id "
            "JOIN activities a ON asess.activity_id = a.activity_id"
        ),
        "order_by": "asess.initiated_at DESC",
    },
    "activity_params": {
        "label": "Níveis de Atividades",
        "query": (
            "SELECT ap.activity_param_id, ap.activity_id, a.activity_name, "
            "ap.level, ap.level_params, ap.level_up_params, "
            "ap.level_down_params, ap.active, ap.created_at "
            "FROM activity_params ap "
            "JOIN activities a ON ap.activity_id = a.activity_id"
        ),
        "order_by": "ap.created_at DESC",
    },
    "user_activity_params": {
        "label": "Níveis por Usuário",
        "query": (
            "SELECT uap.user_activity_params_id, uap.user_id, u.user_name, "
            "uap.activity_param_id, a.activity_name, ap.level, "
            "uap.active, uap.initiated_at "
            "FROM user_activity_params uap "
            "JOIN users u ON uap.user_id = u.user_id "
            "JOIN activity_params ap ON uap.activity_param_id = ap.activity_param_id "
            "JOIN activities a ON ap.activity_id = a.activity_id"
        ),
        "order_by": "uap.initiated_at DESC",
    },
    "documents": {
        "label": "Documentos",
        "query": (
            "SELECT d.document_id, d.document_name, d.document_content, "
            "d.created_by, u.user_name, d.created_at, d.updated_at "
            "FROM documents d "
            "JOIN users u ON d.created_by = u.user_id"
        ),
        "order_by": "d.updated_at DESC",
    },
}

OPERATOR_MAP = {
    "eq": "=",
    "neq": "!=",
    "contains": "ILIKE",
    "gt": ">",
    "gte": ">=",
    "lt": "<",
    "lte": "<=",
}


class FilterItem(BaseModel):
    column: str
    operator: str
    value: str
    connector: Optional[str] = None  # "AND" or "OR", null for the first filter


class QueryRequest(BaseModel):
    table: str
    limit: int = 10
    filters: List[FilterItem] = []


def _get_column_alias(table_config: dict, col_name: str) -> str:
    """Resolve column names that might need table alias prefix."""
    query = table_config["query"].upper()
    if " JOIN " not in query:
        return col_name

    select_part = query.split("FROM")[0]
    for segment in select_part.split(","):
        segment = segment.strip()
        if segment.endswith(f" {col_name.upper()}"):
            alias_part = segment.split()[-2] if len(segment.split()) > 1 else col_name
            if "." in alias_part.lower():
                return alias_part.lower()
        if f".{col_name.upper()}" in segment:
            parts = segment.split()
            for p in parts:
                if f".{col_name.upper()}" in p.upper():
                    return p.lower().rstrip(",")
    return col_name


@router.get("/tables")
async def list_tables(current_user: TokenData = Depends(get_current_user)):
    return [
        {"id": table_id, "label": config["label"]}
        for table_id, config in ALLOWED_TABLES.items()
    ]


@router.get("/columns")
async def list_columns(table: str, current_user: TokenData = Depends(get_current_user)):
    if table not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail="Tabela não permitida")

    config = ALLOWED_TABLES[table]
    select_part = config["query"].split("FROM")[0].replace("SELECT ", "", 1)

    columns = []
    for col_expr in select_part.split(","):
        col_expr = col_expr.strip()
        parts = col_expr.split()
        if len(parts) >= 3 and parts[-2].upper() == "AS":
            columns.append(parts[-1])
        elif "." in parts[-1]:
            columns.append(parts[-1].split(".")[-1])
        else:
            columns.append(parts[-1])

    return columns


def _build_filter_clause(config: dict, f: FilterItem):
    """Builds a single WHERE clause + param from a FilterItem."""
    if f.operator not in OPERATOR_MAP:
        raise HTTPException(status_code=400, detail=f"Operador inválido: {f.operator}")
    col_ref = _get_column_alias(config, f.column)
    sql_op = OPERATOR_MAP[f.operator]
    clause = f"CAST({col_ref} AS TEXT) {sql_op} %s"
    value = f"%{f.value}%" if f.operator == "contains" else f.value
    return {"clause": clause, "connector": f.connector}, value


def _build_where(where_clauses: list) -> str:
    """Combines a list of clause dicts into a single WHERE string."""
    if not where_clauses:
        return ""
    conditions = where_clauses[0]["clause"]
    for wc in where_clauses[1:]:
        connector = wc["connector"] if wc["connector"] in ("AND", "OR") else "AND"
        conditions += f" {connector} {wc['clause']}"
    return f" WHERE {conditions}"


def _run_query(sql: str, params: list) -> dict:
    """Executes the SQL and returns columns + data."""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params if params else None)
            rows = cur.fetchall()
            data = [dict(row) for row in rows]
            columns = [desc[0] for desc in cur.description] if cur.description else []
            return {"columns": columns, "data": data, "total": len(data)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao executar consulta: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Erro ao executar consulta: {str(e)}"
        )
    finally:
        if conn:
            conn.close()


@router.post("/query")
async def execute_query(
    body: QueryRequest, current_user: TokenData = Depends(get_current_user)
):
    if body.table not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail="Tabela não permitida")

    config = ALLOWED_TABLES[body.table]
    limit = max(1, min(body.limit, 1000))

    where_clauses = []
    params = []
    for f in body.filters:
        clause, value = _build_filter_clause(config, f)
        where_clauses.append(clause)
        params.append(value)

    sql = config["query"] + _build_where(where_clauses)
    sql += f" ORDER BY {config['order_by']} LIMIT {limit}"

    return _run_query(sql, params)
