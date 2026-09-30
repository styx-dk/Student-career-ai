from sqlalchemy import select
from conftest import USER_A, USER_B
from app.api.routes import jds
from app.models.entities import CareerRecord, EvidenceState, JobDescription, StudentProfile
from app.schemas.contracts import JDAnalysis, JDRequirementDetail
from app.services.career_summary import refresh_summary
from app.services.role_requirements import clean_extracted_requirements, review_stored_requirements


def test_requirement_cleanup_separates_vague_and_behavioral_expectations():
    analysis = JDAnalysis(requirements=[
        JDRequirementDetail(skill="version control tools like Git", category="tool", evidence_expectation="Show commits and branches."),
        JDRequirementDetail(skill="core programming languages", category="technical"),
        JDRequirementDetail(skill="team communication", category="soft_skill"),
        JDRequirementDetail(skill="Python", category="technical", source_excerpt="Build APIs using Python"),
        JDRequirementDetail(skill="python", importance="preferred", category="technical"),
    ])
    requirements, competencies = clean_extracted_requirements(analysis)
    assert [r["skill"] for r in requirements] == ["git", "python"]
    assert requirements[0]["evidence_expectation"] == "Show commits and branches."
    assert "core programming languages" in competencies and "team communication" in competencies
    reviewed, excluded = review_stored_requirements([
        {"skill": "problem-solving abilities"}, {"skill": "version control tools like Git"}, {"skill": "Git"}
    ])
    assert [r["skill"] for r in reviewed] == ["git"]
    assert excluded == ["problem-solving abilities"]


def test_analysis_stores_useful_requirements_and_confirmed_match_only(client, db, monkeypatch):
    role = client.post('/api/v1/job-descriptions', json={"name": "API role", "raw_text": "Required: Python. Communicate with the team."}).json()
    class Provider:
        def analyze_jd(self, text):
            return JDAnalysis(job_title="API developer", requirements=[
                JDRequirementDetail(skill="Python", category="technical", evidence_expectation="Show an API you built.", source_excerpt="Required: Python"),
                JDRequirementDetail(skill="team communication", category="soft_skill")])
    monkeypatch.setattr(jds, 'provider_for', lambda *args: Provider())
    analyzed = client.post(f'/api/v1/job-descriptions/{role["id"]}/analyze').json()
    assert analyzed['requirements'][0]['skill'] == 'python'
    assert analyzed['requirements'][0]['evidence_expectation'] == 'Show an API you built.'
    assert analyzed['analysis']['general_competencies'] == ['team communication']
    # A manual claim must not count as reviewed role evidence.
    client.post('/api/v1/records', json={"record_type": "project", "title": "Claim", "skills": ["Python"]})
    match = client.get(f'/api/v1/job-descriptions/{role["id"]}/match').json()
    assert match['requirements'][0]['classification'] == 'Missing'
    record = db.scalar(select(CareerRecord))
    record.evidence_state = EvidenceState.user_confirmed
    db.commit()
    match = client.get(f'/api/v1/job-descriptions/{role["id"]}/match').json()
    assert match['requirements'][0]['classification'] == 'Strong Match'
    assert match['requirements'][0]['evidence'][0]['title'] == 'Claim'


def test_profile_insights_are_source_aware_connected_and_private(client, db, as_user):
    profile = StudentProfile(student_id=USER_A, full_name="Example Student", headline="Computer science student")
    role = JobDescription(student_id=USER_A, name="Backend role", raw_text="Python and SQL", requirements=[
        {"skill": "Python", "importance": "required", "weight": 2, "evidence_expectation": "Show an API."},
        {"skill": "SQL", "importance": "required", "weight": 2, "evidence_expectation": "Show schema and queries."},
        {"skill": "logical thinking", "importance": "required", "weight": 2}], analysis={})
    project = CareerRecord(student_id=USER_A, record_type="project", title="API project", description="Built an API for a class.", skills=["Python"], evidence_state=EvidenceState.user_confirmed)
    legacy = CareerRecord(student_id=USER_A, record_type="other", title="Resume of Example Student", description="Resume", skills=["CSS"], evidence_state=EvidenceState.user_confirmed)
    db.add_all([profile, role, project, legacy]); db.flush(); refresh_summary(db, USER_A); db.commit()
    data = client.get(f'/api/v1/profile/evidence?role_id={role.id}').json()
    assert data['student']['name'] == 'Example Student'
    assert 'Across non-resume evidence' in data['summary']
    assert 'Resume-only claims' in data['summary']
    assert data['insights']['alignment']['supported'][0]['skill'] == 'python'
    assert data['insights']['alignment']['gaps'][0]['skill'] == 'sql'
    assert data['insights']['alignment']['general_competencies'] == ['logical thinking']
    assert any(item['code'] == 'legacy_resume' for item in data['insights']['limitations'])
    css = next(item for item in data['skills'] if item['name'] == 'css')
    assert css['sources'][0]['basis'] == 'Resume claim'
    as_user(USER_B)
    other = client.get(f'/api/v1/profile/evidence?role_id={role.id}').json()
    assert other['records'] == [] and other['insights']['alignment'] is None
