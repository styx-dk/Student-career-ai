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
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == student_id))
    return {"student": {"name": profile.full_name, "headline": profile.headline, "target_role": profile.target_role} if profile else {},
        "skills": [{"name": name, "sources": sources} for name, sources in sorted(skills.items())],
        "records": [{"id": str(r.id), "title": r.title, "type": r.record_type, "summary": r.description,
            "organization": r.organization, "start_date": r.start_date, "end_date": r.end_date,
            "skills": r.skills, "document_id": str(r.source_document_id) if r.source_document_id else None,
            "details": r.metadata_json} for r in records]}

def factual_summary(facts):
    if not facts["records"]:
        return None
    student = facts.get("student", {})
    sentences = []
    if student.get("headline"):
        sentences.append(f"Your stated focus: {student['headline'].rstrip('.')}.")
    for kind, label in [("education", "Education"), ("project", "Project work"), ("internship", "Internship experience"), ("certification", "Credentials")]:
        matches = [r for r in facts["records"] if r["type"] == kind]
        if matches:
            r = matches[0]
            text = " ".join((r.get("summary") or r["title"]).split())
            text = text if len(text) <= 220 else text[:217].rsplit(" ", 1)[0] + "…"
            sentences.append(f"{label}: {text}")
    if not sentences:
        r = facts["records"][0]
        text = " ".join((r.get("summary") or r["title"]).split())
        sentences.append("Your reviewed work: " + text[:280])
    if student.get("target_role"):
        sentences.append(f"You are working toward {student['target_role']}.")
    sentences.append("Based on information you reviewed; resume claims are self-reported, not independently verified.")
    return " ".join(sentences)


def refresh_summary(db, student_id):
    facts = confirmed_profile(db, student_id)
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == student_id))
    if not profile:
        profile = StudentProfile(student_id=student_id, full_name="")
        db.add(profile)
    profile.summary = factual_summary(facts)
    return facts
