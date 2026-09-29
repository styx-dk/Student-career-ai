from datetime import timedelta
from sqlalchemy import select
from conftest import USER_A, USER_B
from app.models.entities import CareerRecord, JobDescription, ResumeVersion
from app.api.routes import resumes
from test_drive_workflow import fake_storage


def reviewed_document(client, monkeypatch):
    fake_storage(monkeypatch)
    doc = client.post('/api/v1/documents', files={"file": ("project.txt", b"Python API", "text/plain")}).json()
    client.post(f'/api/v1/documents/{doc["id"]}/process')
    client.post(f'/api/v1/documents/{doc["id"]}/review', json={"decision": "accept"})
    return doc


def test_pdf_download_is_direct_and_private(client, monkeypatch, as_user):
    reviewed_document(client, monkeypatch)
    resume = client.post('/api/v1/resumes', json={"name": "My resume"}).json()
    path = f'/api/v1/resumes/{resume["id"]}'
    assert client.get(path).json()['content']['skills'] == ['python']
    response = client.get(path + '/pdf', headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.headers['content-type'] == 'application/pdf'
    assert response.headers['cache-control'] == 'private, no-store'
    assert response.content.startswith(b'%PDF-')
    import fitz
    with fitz.open(stream=response.content, filetype='pdf') as pdf:
        assert 'API project' in ''.join(page.get_text() for page in pdf)
    as_user(USER_B)
    assert client.get(path).status_code == 404
    assert client.get(path + '/pdf').status_code == 404


def test_export_render_error_is_actionable(client, monkeypatch):
    reviewed_document(client, monkeypatch)
    resume = client.post('/api/v1/resumes', json={"name": "My resume"}).json()
    def fail(*args):
        raise RuntimeError('private details')
    monkeypatch.setattr(resumes, 'render_resume_pdf', fail)
    response = client.get(f'/api/v1/resumes/{resume["id"]}/pdf')
    assert response.status_code == 500
    assert 'private details' not in response.text
    assert 'saved resume is unchanged' in response.text


def test_cockpit_connects_only_owned_reviewed_evidence(client, db, monkeypatch, as_user):
    doc = reviewed_document(client, monkeypatch)
    role = JobDescription(student_id=USER_A, name='API developer', raw_text='Python and SQL', requirements=[{'skill': 'Python'}, {'skill': 'python'}, {'skill': 'SQL'}])
    db.add(role); db.commit(); db.refresh(role)
    client.post('/api/v1/records', json={'record_type': 'project', 'title': 'Unconfirmed SQL claim', 'skills': ['SQL']})
    resume = client.post('/api/v1/resumes', json={'name': 'Snapshot'}).json()
    data = client.get(f'/api/v1/profile/cockpit?role_id={role.id}').json()
    assert data['supported'] == 1 and data['total'] == 2
    assert data['requirements'][0]['sources'][0]['document_id'] == doc['id']
    assert data['requirements'][1]['sources'] == []
    assert not data['resumes'][0]['needs_review']
    record = db.scalar(select(CareerRecord).where(CareerRecord.source_document_id.is_not(None)))
    version = db.scalar(select(ResumeVersion))
    record.updated_at = version.created_at + timedelta(seconds=2)
    db.commit()
    assert client.get('/api/v1/profile/cockpit').json()['resumes'][0]['changed_sources'] == 1
    client.delete(f'/api/v1/documents/{doc["id"]}')
    assert client.get('/api/v1/profile/cockpit').json()['resumes'][0]['changed_sources'] == 1
    as_user(USER_B)
    assert client.get(f'/api/v1/profile/cockpit?role_id={role.id}').status_code == 404
    empty = client.get('/api/v1/profile/cockpit').json()
    assert empty['roles'] == [] and empty['resumes'] == [] and empty['total'] == 0
