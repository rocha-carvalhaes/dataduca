import sys
from pathlib import Path

# Repositório como cwd não coloca `app` no PYTHONPATH (ex.: GitHub Actions).
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)
