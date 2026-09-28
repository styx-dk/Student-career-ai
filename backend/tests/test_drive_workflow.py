from sqlalchemy import select
from conftest import USER_B
from app.api.routes import documents
from app.models.entities import CareerRecord
from app.schemas.document_analysis import DocumentAnalysis

def fake_storage(monkeypatch):
    monkeypatch.setattr(documents, "upload_bytes", lambda *args: None)
    monkeypatch.setattr(documents, "download_bytes", lambda *args: b"EXAMPLE student built an API using Python.")
    monkeypatch.setattr(documents, "remove_object", lambda *args: None)
    class Provider:
        name = "test"
        def analyze_text_document(self, text, schema):
            return DocumentAnalysis(title="API project", summary="EXAMPLE: Built a Python API.", document_type="project", skills=["Python"], mentioned_skills=["AWS"])
    monkeypatch.setattr(documents, "provider_for", lambda *args: Provider())

def test_drive_confirmation_revision_delete(client, db, monkeypatch):
    fake_storage(monkeypatch)
    folder = client.post('/api/v1/folders', json={"name":"Projects"}).json()
    response = client.post('/api/v1/documents', data={"folder_id":folder['id']}, files={"file":("project.txt",b"Example project text", "text/plain")})
    assert response.status_code == 201
    doc_id = response.json()['id']
    assert client.post(f'/api/v1/documents/{doc_id}/process').status_code == 200
    assert client.get('/api/v1/profile/evidence').json()['records'] == []
    for _ in range(2):
        assert client.post(f'/api/v1/documents/{doc_id}/review', json={"decision":"accept"}).status_code == 200
    assert len(db.scalars(select(CareerRecord)).all()) == 1
    profile = client.get('/api/v1/profile/evidence').json()
    assert [s['name'] for s in profile['skills']] == ['python']
    assert 'aws' not in profile['summary'].lower()
    assert client.post(f'/api/v1/documents/{doc_id}/process').status_code == 200
    assert client.post(f'/api/v1/documents/{doc_id}/review', json={"decision":"reject"}).status_code == 200
    assert len(client.get('/api/v1/profile/evidence').json()['records']) == 1
    assert client.delete(f'/api/v1/folders/{folder["id"]}').status_code == 409
    assert client.delete(f'/api/v1/documents/{doc_id}').status_code == 204
    profile = client.get('/api/v1/profile/evidence').json()
    assert profile['skills'] == [] and profile['summary'] is None

def test_cross_user_folder_and_documents(client, as_user, monkeypatch):
    fake_storage(monkeypatch)
    folder = client.post('/api/v1/folders', json={"name":"Private"}).json()
    doc = client.post('/api/v1/documents', files={"file":("private.txt",b"Private project", "text/plain")}).json()
    as_user(USER_B)
    assert client.get('/api/v1/folders').json() == []
    assert client.post('/api/v1/folders', json={"name":"Child", "parent_id":folder['id']}).status_code == 404
    assert client.post(f'/api/v1/documents/{doc["id"]}/process').status_code == 404
    assert client.post('/api/v1/documents', data={"folder_id":folder['id']}, files={"file":("x.txt",b"text", "text/plain")}).status_code == 404

def test_analysis_failure_preserves_original(client, monkeypatch):
    fake_storage(monkeypatch)
    doc = client.post('/api/v1/documents', files={"file":("x.txt",b"Example project", "text/plain")}).json()
    def fail(*args):
        raise RuntimeError("Provider unavailable")
    monkeypatch.setattr(documents, "provider_for", fail)
    assert client.post(f'/api/v1/documents/{doc["id"]}/process').status_code == 422
    remaining = client.get('/api/v1/documents').json()
    assert len(remaining) == 1 and remaining[0]['processing_status'] == 'failed'
