"""Connect reviewed evidence to role requirements and saved resume snapshots."""
from sqlalchemy import select
from app.models.entities import Document, JobDescription, Resume, ResumeVersion, CareerRecord, EvidenceState, StudentProfile
from app.services.skills import normalize_skill


def career_cockpit(db, student_id, role_id=None):
    roles = db.scalars(select(JobDescription).where(JobDescription.student_id == student_id).order_by(JobDescription.created_at.desc())).all()
    role = next((r for r in roles if r.id == role_id), None) if role_id else (roles[0] if roles else None)
    if role_id and role is None:
        from fastapi import HTTPException
        raise HTTPException(404, "Target role not found")
    records = db.scalars(select(CareerRecord).where(CareerRecord.student_id == student_id,
        CareerRecord.evidence_state == EvidenceState.user_confirmed)).all()
    docs = db.scalars(select(Document).where(Document.student_id == student_id)).all()
    resumes = db.scalars(select(Resume).where(Resume.student_id == student_id).order_by(Resume.created_at.desc())).all()
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == student_id))
    evidence = {}
    for record in records:
        for skill in {normalize_skill(s) for s in record.skills if normalize_skill(s)}:
            evidence.setdefault(skill, []).append({"title": record.title, "document_id": str(record.source_document_id) if record.source_document_id else None,
                "record_id": str(record.id), "basis": "Resume claim" if record.metadata_json.get("resume_claim") else "Reviewed document"})
    requirements = []
    seen = set()
    for item in role.requirements if role else []:
        skill = normalize_skill(item.get("skill", ""))
        if not skill or skill in seen:
            continue
        seen.add(skill)
        requirements.append({"skill": skill, "importance": item.get("importance", "required"), "sources": evidence.get(skill, [])})
    supported = sum(bool(r["sources"]) for r in requirements)
    snapshots = []
    versions = db.scalars(select(ResumeVersion).where(ResumeVersion.student_id == student_id)).all()
    version_map = {(v.resume_id, v.version_number): v for v in versions}
    record_map = {str(r.id): r for r in records}
    for resume in resumes[:6]:
        version = version_map.get((resume.id, resume.current_version))
        if not version:
            continue
        ids = {str(i) for values in version.claim_sources.values() for i in values}
        changed = sum(i not in record_map or record_map[i].updated_at.replace(tzinfo=None) > version.created_at.replace(tzinfo=None) for i in ids)
        new = sum(str(r.id) not in ids and r.created_at.replace(tzinfo=None) > version.created_at.replace(tzinfo=None) for r in records)
        personal_changed = bool(profile and profile.updated_at.replace(tzinfo=None) > version.created_at.replace(tzinfo=None))
        snapshots.append({"id": str(resume.id), "name": resume.name, "changed_sources": changed, "new_records": new,
            "profile_changed": personal_changed, "needs_review": bool(changed or new or personal_changed)})
    return {"roles": [{"id": str(r.id), "name": r.job_title or r.name} for r in roles],
        "selected_role": str(role.id) if role else None, "requirements": requirements,
        "supported": supported, "total": len(requirements), "resumes": snapshots,
        "journey": [{"label": "Collect", "count": len(docs), "detail": "uploaded documents", "href": "/documents"},
            {"label": "Understand", "count": len(records), "detail": "reviewed career entries", "href": "/profile"},
            {"label": "Prepare", "count": len(roles), "detail": "target roles", "href": "/planning/roles"},
            {"label": "Apply", "count": len(resumes), "detail": "resume snapshots", "href": "/resumes"}]}
