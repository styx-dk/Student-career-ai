"""Private, evidence-driven next steps. No invented completion or employability scores."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.models.entities import ActivityLog, Document, DocumentExtraction, ProcessingStatus


def student_progress(db, student_id, offset_minutes=0):
    docs = db.scalars(select(Document).where(Document.student_id == student_id)).all()
    today = (datetime.now(timezone.utc) + timedelta(minutes=offset_minutes)).date()
    events = db.scalars(select(ActivityLog).where(
        ActivityLog.student_id == student_id, ActivityLog.event_type == "document_reviewed",
        ActivityLog.created_at >= datetime.now(timezone.utc) - timedelta(days=8))).all()
    active = {(e.created_at + timedelta(minutes=offset_minutes)).date() for e in events}
    days = [{"date": (today - timedelta(days=i)).isoformat(), "completed": today - timedelta(days=i) in active}
            for i in reversed(range(7))]
    quests = []
    pending = next((d for d in docs if d.processing_status == ProcessingStatus.needs_review), None)
    if pending:
        quests.append({"title": "Review one document", "detail": "Check the extracted facts and keep only what describes your work.", "href": f"/documents/{pending.id}"})
    resumes = [d for d in docs if d.category == "resume"]
    if not resumes:
        quests.append({"title": "Add your current resume", "detail": "Upload it, analyze it and choose the resume category. Review each education and career entry.", "href": "/documents"})
    checks = []
    for doc in sorted(resumes, key=lambda d: d.created_at, reverse=True)[:5]:
        revision = db.scalar(select(DocumentExtraction).where(DocumentExtraction.student_id == student_id,
            DocumentExtraction.document_id == doc.id).order_by(DocumentExtraction.created_at.desc(), DocumentExtraction.id.desc()))
        data = (revision.confirmed_result or revision.ai_result or {}) if revision else {}
        entries = data.get("entries", [])
        issues = list(data.get("uncertainties", []))[:5]
        if not entries:
            issues.append("Analyze this resume again to extract separate education and career entries.")
        if entries and not any(e.get("document_type") == "education" for e in entries):
            issues.append("No education entry found. Check whether your resume needs one.")
        missing = sum(not e.get("start_date") and not e.get("end_date") for e in entries)
        if missing:
            issues.append(f"{missing} entries have no structured dates. Check the original; do not guess missing dates.")
        checks.append({"id": str(doc.id), "name": doc.display_name or doc.original_filename,
                       "confirmed": bool(revision and revision.is_confirmed), "issues": issues})
    if checks:
        quests.append({"title": "Give your resume a quick check", "detail": "Review missing details and keep your latest achievements up to date.", "href": f"/documents/{checks[0]['id']}"})
    quests.append({"title": "Choose one learning step", "detail": "Compare a target role with your profile and pick a manageable activity.", "href": "/planning/roles"})
    return {"days": days, "active_days": sum(d["completed"] for d in days), "reviewed_today": today in active,
            "quests": quests[:3], "resumes": checks}
