from sqlalchemy import select
from conftest import USER_B
from app.models.entities import ActivityLog, CareerRecord
from test_drive_workflow import fake_storage


def test_resume_entries_confirmation_and_progress(client, db, monkeypatch, as_user):
    fake_storage(monkeypatch)
    doc = client.post('/api/v1/documents', files={"file": ("resume.txt", b"Student resume example", "text/plain")}).json()
    path = f'/api/v1/documents/{doc["id"]}'
    client.post(path + '/process')
    analysis = {"document_type": "resume", "title": "Student resume", "summary": "Education and project work.", "skills": ["unsupported"], "entries": [
        {"document_type": "education", "title": "Computer science degree", "summary": "Studying computer science."},
        {"document_type": "project", "title": "API project", "summary": "Built a Python API.", "skills": ["Python"]}]}
    for _ in range(2):
        result = client.post(path + '/review', json={"decision": "accept", "corrected_result": analysis})
        assert result.status_code == 200, result.text
        assert result.json()['record_count'] == 2
    facts = client.get('/api/v1/profile/evidence').json()
    assert len(facts['records']) == 2
    assert [s['name'] for s in facts['skills']] == ['python']
    assert 'Studying computer science' in facts['summary']
    assert all(r['details']['resume_claim'] for r in facts['records'])
    assert len(db.scalars(select(ActivityLog)).all()) == 1
    progress = client.get('/api/v1/profile/progress?offset_minutes=330').json()
    assert progress['reviewed_today'] and progress['active_days'] == 1
    assert len(progress['resumes']) == 1
    assert progress['resumes'][0]['issues']
    client.post(path + '/process')
    analysis['entries'] = analysis['entries'][:1]
    assert client.post(path + '/review', json={"decision": "accept", "corrected_result": analysis}).status_code == 200
    assert len(db.scalars(select(CareerRecord)).all()) == 1
    as_user(USER_B)
    private = client.get('/api/v1/profile/progress').json()
    assert private['resumes'] == [] and private['active_days'] == 0
    assert client.post(path + '/review', json={"decision": "accept"}).status_code == 404


def test_invalid_resume_does_not_replace_evidence(client, monkeypatch):
    fake_storage(monkeypatch)
    doc = client.post('/api/v1/documents', files={"file": ("resume.txt", b"Student resume example", "text/plain")}).json()
    path = f'/api/v1/documents/{doc["id"]}'
    client.post(path + '/process')
    client.post(path + '/review', json={"decision": "accept"})
    for entries in [[], [{"title": " ", "summary": "Invalid"}], [{"title": "Bad dates", "summary": "Invalid", "start_date": "2026-01-01", "end_date": "2025-01-01"}]]:
        result = client.post(path + '/review', json={"decision": "accept", "corrected_result": {"title": "Resume", "summary": "Resume", "document_type": "resume", "entries": entries}})
        assert result.status_code == 422
        assert len(client.get('/api/v1/profile/evidence').json()['records']) == 1
    assert client.get('/api/v1/profile/progress?offset_minutes=9999').status_code == 422
