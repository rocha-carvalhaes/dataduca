"""Testes mínimos de autorização (sem banco: rotas protegidas exigem Bearer)."""

from fastapi.testclient import TestClient


def test_health_public(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_get_user_by_id_requires_auth(client: TestClient):
    r = client.get("/api/users/1")
    assert r.status_code == 401


def test_list_users_requires_auth(client: TestClient):
    r = client.get("/api/users/")
    assert r.status_code == 401


def test_manage_tables_requires_auth(client: TestClient):
    r = client.get("/api/manage/tables")
    assert r.status_code == 401


def test_activity_params_list_requires_auth(client: TestClient):
    r = client.get("/api/activity-params/")
    assert r.status_code == 401


def test_activities_list_requires_auth(client: TestClient):
    r = client.get("/api/activities/list")
    assert r.status_code == 401


def test_quests_list_requires_auth(client: TestClient):
    r = client.get("/api/quests/")
    assert r.status_code == 401


def test_senha_forte_params_requires_auth_with_activity_id(client: TestClient):
    r = client.get("/api/activities/senha-forte/params?activity_id=1")
    assert r.status_code == 401


def test_senha_forte_validate_requires_auth(client: TestClient):
    r = client.post(
        "/api/activities/senha-forte/validate",
        json={"activity_id": 1, "password": "x"},
    )
    assert r.status_code == 401
