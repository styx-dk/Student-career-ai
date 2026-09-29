from sqlalchemy import select
from conftest import USER_A, USER_B
from app.models.entities import JobDescription, CareerPlan, SimulationResult, Resume, ResumeVersion


def seed(db):
    role = JobDescription(student_id=USER_A, name="Target", raw_text="Example target role")
    db.add(role); db.flush()
    plan = CareerPlan(student_id=USER_A, job_description_id=role.id, target_role="Target", current_readiness=0, target_readiness=80)
    sim = SimulationResult(student_id=USER_A, job_description_id=role.id, baseline_score=0, simulated_score=10)
    resume = Resume(student_id=USER_A, job_description_id=role.id, name="Keep snapshot")
    db.add_all([plan, sim, resume]); db.flush()
    version = ResumeVersion(student_id=USER_A, resume_id=resume.id, version_number=1, content={}, claim_sources={})
    db.add(version); db.commit()
    return role.id, plan.id, resume.id


def test_role_delete_preserves_resume_and_cleans_dependencies(client, db, as_user):
    role, plan, resume = seed(db)
    as_user(USER_B)
    assert client.delete(f'/api/v1/job-descriptions/{role}').status_code == 404
    assert client.delete(f'/api/v1/career/plans/{plan}').status_code == 404
    assert client.delete(f'/api/v1/resumes/{resume}').status_code == 404
    assert client.delete(f'/api/v1/career/simulations?job_description_id={role}').status_code == 404
    as_user(USER_A)
    assert client.delete(f'/api/v1/job-descriptions/{role}').status_code == 204
    db.expire_all()
    assert db.get(JobDescription, role) is None
    assert db.scalars(select(CareerPlan)).all() == []
    assert db.scalars(select(SimulationResult)).all() == []
    assert db.get(Resume, resume).job_description_id is None
    assert len(db.scalars(select(ResumeVersion)).all()) == 1
    assert client.delete(f'/api/v1/job-descriptions/{role}').status_code == 404


def test_individual_deletes_leave_related_items(client, db):
    role, plan, resume = seed(db)
    assert client.delete(f'/api/v1/career/plans/{plan}').status_code == 204
    assert client.delete(f'/api/v1/career/simulations?job_description_id={role}').status_code == 204
    assert client.delete(f'/api/v1/resumes/{resume}').status_code == 204
    db.expire_all()
    assert db.get(JobDescription, role)
    assert db.scalars(select(ResumeVersion)).all() == []
    assert db.scalars(select(SimulationResult)).all() == []
    assert client.delete(f'/api/v1/resumes/{resume}').status_code == 404


def test_legacy_export_failure_keeps_resume(client, db, monkeypatch):
    from app.services import storage
    _, _, resume = seed(db)
    version = db.scalar(select(ResumeVersion))
    version.storage_path = f'{USER_A}/{resume}/v1.pdf'
    db.commit()
    def fail(*args):
        raise RuntimeError("Private storage details")
    monkeypatch.setattr(storage, 'remove_object', fail)
    response = client.delete(f'/api/v1/resumes/{resume}')
    assert response.status_code == 503 and "Private storage details" not in response.text
    db.expire_all()
    assert db.get(Resume, resume)
    removed = []
    monkeypatch.setattr(storage, 'remove_object', lambda bucket, path: removed.append(path))
    assert client.delete(f'/api/v1/resumes/{resume}').status_code == 204
    assert removed == [f'{USER_A}/{resume}/v1.pdf']
