"""Source-linked profile built from confirmed evidence."""
from sqlalchemy import select
from app.models.entities import CareerRecord, EvidenceState, StudentProfile, JobDescription
from app.services.skills import normalize_skill

def confirmed_profile(db, student_id):
    records = db.scalars(select(CareerRecord).where(
        CareerRecord.student_id == student_id, CareerRecord.evidence_state == EvidenceState.user_confirmed
    ).order_by(CareerRecord.start_date.desc(), CareerRecord.title)).all()
    skills = {}
    for record in records:
        for key in sorted({normalize_skill(name) for name in record.skills}):
            if key:
                basis = "Resume claim" if (record.metadata_json or {}).get("resume_claim") or (record.record_type == "other" and "resume" in record.title.lower()) else "Reviewed document"
                skills.setdefault(key, []).append({"record_id": str(record.id), "document_id": str(record.source_document_id) if record.source_document_id else None, "title": record.title, "basis": basis})
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == student_id))
    return {"student": {"name": profile.full_name, "headline": profile.headline, "target_role": profile.target_role} if profile else {},
        "skills": [{"name": name, "sources": sources} for name, sources in sorted(skills.items())],
        "records": [{"id": str(r.id), "title": r.title, "type": r.record_type, "summary": r.description,
            "organization": r.organization, "start_date": r.start_date, "end_date": r.end_date,
            "skills": r.skills, "document_id": str(r.source_document_id) if r.source_document_id else None,
            "details": r.metadata_json or {}, "evidence_basis": "Resume claim" if (r.metadata_json or {}).get("resume_claim") or (r.record_type == "other" and "resume" in r.title.lower()) else "Reviewed document"} for r in records]}


def profile_insights(db, student_id, role_id=None):
    facts = confirmed_profile(db, student_id)
    records, skills = facts["records"], facts["skills"]
    role = None
    if role_id:
        role = db.scalar(select(JobDescription).where(JobDescription.id == role_id, JobDescription.student_id == student_id))
    else:
        role = db.scalar(select(JobDescription).where(JobDescription.student_id == student_id).order_by(JobDescription.created_at.desc()))
    dated = sum(bool(r["start_date"] or r["end_date"]) for r in records)
    resume_claims = sum(r["evidence_basis"] == "Resume claim" for r in records)
    multi_source = sum(len(s["sources"]) > 1 for s in skills)
    strengths = []
    for skill in sorted(skills, key=lambda s: (-len(s["sources"]), s["name"]))[:8]:
        contexts = list(dict.fromkeys(src["title"] for src in skill["sources"]))[:3]
        bases = {src["basis"] for src in skill["sources"]}
        strengths.append({"skill": skill["name"], "source_count": len(skill["sources"]), "contexts": contexts,
                          "confidence": "repeated evidence" if len(skill["sources"]) > 1 else "single reviewed source",
                          "basis": "resume claim only" if bases == {"Resume claim"} else "reviewed work"})
    limitations = []
    legacy = [r for r in records if r["type"] == "other" and "resume" in r["title"].lower() and not r["details"].get("source_kind")]
    if legacy:
        limitations.append({"code": "legacy_resume", "text": "A previously analyzed resume is still one combined entry. Reanalyze it to separate education, projects and experience.", "href": f"/documents/{legacy[0]['document_id']}" if legacy[0]["document_id"] else "/documents"})
    if records and dated < len(records):
        limitations.append({"code": "missing_dates", "text": f"{len(records)-dated} of {len(records)} reviewed entries have no structured dates. Add dates only when the source supports them.", "href": "/profile?tab=timeline"})
    if skills and not multi_source:
        limitations.append({"code": "single_source", "text": "Every documented skill currently comes from one source. A second independent project or credential would show consistency.", "href": "/documents"})
    if not any(r["type"] == "education" for r in records):
        limitations.append({"code": "education", "text": "No separate education entry is available in the reviewed profile.", "href": "/documents"})
    alignment = None
    if role and role.requirements:
        from app.services.matching import calculate_readiness
        from app.services.role_requirements import review_stored_requirements
        reqs, excluded = review_stored_requirements(role.requirements)
        result = calculate_readiness(reqs, [s["name"] for s in skills], {s["name"]: s["sources"] for s in skills})
        alignment = {"role_id": str(role.id), "role_name": role.job_title or role.name, "score": result.score,
            "supported": [m.model_dump(mode="json") for m in result.requirements if m.classification != "Missing"],
            "gaps": [m.model_dump(mode="json") for m in result.requirements if m.classification == "Missing"],
            "general_competencies": list(dict.fromkeys((role.analysis or {}).get("general_competencies", []) + excluded)),
            "disclaimer": result.disclaimer}
    next_steps = list(limitations[:2])
    if alignment and alignment["gaps"]:
        gap = alignment["gaps"][0]
        next_steps.insert(0, {"code": "role_gap", "text": f"Build evidence for {gap['skill']}: {gap['evidence_expectation']}", "href": "/planning/roles"})
    return {"strengths": strengths, "portfolio_health": {"reviewed_entries": len(records), "documented_skills": len(skills),
            "dated_entries": dated, "multi_source_skills": multi_source, "resume_claim_entries": resume_claims},
        "limitations": limitations, "alignment": alignment, "next_steps": next_steps[:3]}

def factual_summary(facts):
    if not facts["records"]:
        return None
    student = facts.get("student", {})
    sentences = []
    if student.get("headline"):
        sentences.append(f"{student.get('name') or 'This student'} describes their current focus as {student['headline'].rstrip('.')}.")
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
        sentences.append("Reviewed work: " + text[:280])
    work_skills = [s for s in facts["skills"] if any(src.get("basis") != "Resume claim" for src in s["sources"])]
    resume_skills = [s for s in facts["skills"] if all(src.get("basis") == "Resume claim" for src in s["sources"])]
    if work_skills:
        strongest = sorted(work_skills, key=lambda s: (-len(s["sources"]), s["name"]))[:6]
        sentences.append("Across non-resume evidence, documented technical themes include " + ", ".join(s["name"] for s in strongest) + ".")
    if resume_skills:
        strongest = sorted(resume_skills, key=lambda s: (-len(s["sources"]), s["name"]))[:6]
        sentences.append("Resume-only claims additionally mention " + ", ".join(s["name"] for s in strongest) + "; these remain self-reported until supported by other work.")
    if student.get("target_role"):
        sentences.append(f"You are working toward {student['target_role']}.")
    sentences.append("This profile is based on information the student reviewed. Resume statements are self-reported, and missing dates, outcomes or proficiency levels are intentionally not invented.")
    return " ".join(sentences)


def refresh_summary(db, student_id):
    facts = confirmed_profile(db, student_id)
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == student_id))
    if not profile:
        profile = StudentProfile(student_id=student_id, full_name="")
        db.add(profile)
    profile.summary = factual_summary(facts)
    return facts
