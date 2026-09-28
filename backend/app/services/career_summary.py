"""Source-linked profile built from confirmed evidence."""
from sqlalchemy import select
from app.models.entities import CareerRecord, EvidenceState, StudentProfile
from app.services.skills import normalize_skill

def confirmed_profile(db, student_id):
    records = db.scalars(select(CareerRecord).where(
        CareerRecord.student_id == student_id, CareerRecord.evidence_state == EvidenceState.user_confirmed
    ).order_by(CareerRecord.start_date.desc(), CareerRecord.title)).all()
    skills = {}
    for record in records:
        for name in record.skills:
            key = normalize_skill(name)
            if key:
                skills.setdefault(key, []).append({"record_id": str(record.id), "document_id": str(record.source_document_id) if record.source_document_id else None, "title": record.title})
    return {"skills": [{"name": name, "sources": sources} for name, sources in sorted(skills.items())],
        "records": [{"id": str(r.id), "title": r.title, "type": r.record_type, "summary": r.description,
            "organization": r.organization, "start_date": r.start_date, "end_date": r.end_date,
            "skills": r.skills, "document_id": str(r.source_document_id) if r.source_document_id else None,
            "details": r.metadata_json} for r in records]}

def refresh_summary(db, student_id):
    facts = confirmed_profile(db, student_id)
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == student_id))
    if not profile:
        profile = StudentProfile(student_id=student_id, full_name="")
        db.add(profile)
    if not facts["records"]:
        profile.summary = None
    else:
        names = ", ".join(s["name"] for s in facts["skills"])
        titles = "; ".join(r["title"] for r in facts["records"])
        profile.summary = f"Confirmed career records: {titles}." + (f" Documented skills: {names}." if names else "")
    return facts
