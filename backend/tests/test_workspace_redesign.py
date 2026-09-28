from sqlalchemy import select
from conftest import USER_A, USER_B
from app.models.entities import CareerRecord, EvidenceState
from app.services.career_summary import refresh_summary
from test_drive_workflow import fake_storage


def test_duplicate_bytes_are_owner_scoped(client, as_user, monkeypatch):
    fake_storage(monkeypatch)
    upload = {"file": ("example.txt", b"Identical example content", "text/plain")}
    first = client.post("/api/v1/documents", files=upload).json()
    second = client.post("/api/v1/documents", files=upload).json()
    assert second["duplicate"] is True
    assert second["id"] == first["id"]
    assert len(client.get("/api/v1/documents").json()) == 1
    as_user(USER_B)
    assert client.get(f"/api/v1/documents/{first['id']}").status_code == 404
    other = client.post("/api/v1/documents", files=upload).json()
    assert other["id"] != first["id"]


def test_education_roundtrip_and_bounded_summary(client, db):
    response = client.post("/api/v1/records", json={
        "record_type": "education", "title": "Example degree", "skills": ["JS", "javascript"]
    })
    assert response.status_code == 201
    record = db.scalar(select(CareerRecord))
    record.evidence_state = EvidenceState.user_confirmed
    for i in range(200):
        db.add(CareerRecord(student_id=USER_A, record_type="project",
            title=f"Example project {i}", skills=[f"example skill {i}"],
            evidence_state=EvidenceState.user_confirmed))
    db.flush()
    refresh_summary(db, USER_A)
    db.commit()
    data = client.get("/api/v1/profile/evidence").json()
    assert len(data["records"]) == 201
    assert len(data["summary"]) < 1000
    javascript = next(s for s in data["skills"] if s["name"] == "javascript")
    assert len(javascript["sources"]) == 1
    assert client.get("/api/v1/records").status_code == 200


def test_resume_uses_only_confirmed_skills(client, db, monkeypatch):
    fake_storage(monkeypatch)
    client.post("/api/v1/records", json={"record_type": "project", "title": "Personal claim", "skills": ["UnprovenSkill"]})
    assert client.post("/api/v1/resumes", json={"name": "Empty evidence"}).status_code == 409
    doc = client.post("/api/v1/documents", files={"file": ("example.txt", b"EXAMPLE Python work", "text/plain")}).json()
    client.post(f"/api/v1/documents/{doc['id']}/process")
    client.post(f"/api/v1/documents/{doc['id']}/review", json={"decision": "accept"})
    response = client.post("/api/v1/resumes", json={"name": "Evidence only"})
    assert response.status_code == 201
    assert response.json()["content"]["skills"] == ["python"]
    assert "Verified" not in response.json()["content"]["professional_summary"]
    assert "UnprovenSkill" not in str(response.json()["content"])


def test_reanalysis_keeps_confirmed_evidence_visible(client, monkeypatch):
    fake_storage(monkeypatch)
    doc = client.post("/api/v1/documents", files={"file": ("example.txt", b"EXAMPLE Python project", "text/plain")}).json()
    client.post(f"/api/v1/documents/{doc['id']}/process")
    client.post(f"/api/v1/documents/{doc['id']}/review", json={"decision": "accept"})
    client.post(f"/api/v1/documents/{doc['id']}/process")
    draft = client.get(f"/api/v1/documents/{doc['id']}").json()
    assert draft["is_confirmed"] is False
    assert draft["has_confirmed_evidence"] is True
    assert len(client.get("/api/v1/profile/evidence").json()["records"]) == 1


def test_manual_record_deletion_refreshes_summary(client, db):
    record = CareerRecord(student_id=USER_A, record_type="project", title="Example",
        skills=["Python"], evidence_state=EvidenceState.user_confirmed)
    db.add(record)
    db.flush()
    refresh_summary(db, USER_A)
    db.commit()
    response = client.delete(f"/api/v1/records/items/{record.id}")
    assert response.status_code == 204
    assert client.get("/api/v1/profile/evidence").json()["summary"] is None
