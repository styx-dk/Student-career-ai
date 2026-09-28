import os
import uuid
from pathlib import Path

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///./test_career_compass.db"

import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, SessionLocal, engine, get_db
from app.core.security import CurrentUser, get_current_user
from app.main import app


USER_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_B = uuid.UUID("22222222-2222-2222-2222-222222222222")


@pytest.fixture(autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def as_user():
    def switch(user_id=USER_A):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=user_id, email=f"{user_id}@test.local")
    switch(USER_A)
    yield switch
    app.dependency_overrides.clear()


@pytest.fixture
def client(as_user):
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

