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
        for key in sorted({normalize_skill(name) for name in record.skills}):
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
        names = ", ".join(s["name"][:60] for s in facts["skills"][:8])
        titles = "; ".join(r["title"][:100] for r in facts["records"][:3])
        profile.summary = (
            f"Your confirmed profile includes {len(facts['records'])} career records "
            f"and {len(facts['skills'])} documented skills. "
            f"Experience includes {titles}."
            + (f" Skills include {names}." if names else "")
            + " Explore the profile sections for the full details and supporting sources."
        )
    return facts
