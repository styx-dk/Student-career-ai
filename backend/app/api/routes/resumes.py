from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.entities import JobDescription, Resume, ResumeVersion, StudentProfile
from app.services.profile_state import load_profile_state
from app.services.skills import normalize_skill
from app.services.resume_pdf import render_resume_pdf
from app.services.storage import signed_url, upload_bytes


router = APIRouter()


class ResumeRequest(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    job_description_id: UUID | None = None


@router.get("")
def list_resumes(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Resume).where(Resume.student_id == user.id).order_by(Resume.created_at.desc())).all()
    return [{"id": row.id, "name": row.name, "current_version": row.current_version, "created_at": row.created_at} for row in rows]


@router.post("", status_code=201)
def create_resume(payload: ResumeRequest, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    jd = None
    if payload.job_description_id:
        jd = db.scalar(select(JobDescription).where(JobDescription.id == payload.job_description_id, JobDescription.student_id == user.id))
        if not jd:
            raise HTTPException(404, "Job description not found")
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == user.id))
    skills, evidence, records = load_profile_state(db, user.id)
    confirmed = [record for record in records if record.evidence_state.value == "user_confirmed"]
    if not confirmed:
        raise HTTPException(409, "Confirm a document before creating a resume")
    jd_skills = {normalize_skill(item["skill"]) for item in (jd.requirements if jd else [])}
    confirmed_skills = sorted({normalize_skill(s) for record in confirmed for s in record.skills if normalize_skill(s)})
    relevant_skills = [skill for skill in confirmed_skills if not jd_skills or skill in jd_skills]
    selected = [record for record in confirmed if record.record_type == "education" or not jd_skills or jd_skills.intersection({normalize_skill(s) for s in record.skills})]
    summary_bits = []
    if profile and profile.headline:
        summary_bits.append(profile.headline)
    if relevant_skills:
        summary_bits.append(f"Documented experience across {', '.join(relevant_skills[:8])}.")
    content = {
        "professional_summary": " ".join(summary_bits) or "Career profile based on confirmed repository evidence.",
        "skills": relevant_skills,
        "projects": [{"id": str(r.id), "title": r.title, "description": r.description, "skills": r.skills} for r in selected if r.record_type == "project"],
        "internships": [{"id": str(r.id), "title": r.title, "organization": r.organization, "description": r.description, "skills": r.skills} for r in selected if r.record_type == "internship"],
        "achievements": [{"id": str(r.id), "title": r.title, "description": r.description} for r in selected if r.record_type == "achievement"],
        "education": [{"id": str(r.id), "title": r.title, "description": r.description} for r in selected if r.record_type == "education"],
        "certifications": [{"id": str(r.id), "title": r.title, "description": r.description} for r in selected if r.record_type == "certification"],
        "other_experience": [{"id": str(r.id), "title": r.title, "description": r.description} for r in selected if r.record_type in ("workshop", "other")],
    }
    claim_sources = {section: [item["id"] for item in content[section]] for section in ("projects", "internships", "achievements", "education", "certifications", "other_experience")}
    resume = Resume(student_id=user.id, job_description_id=payload.job_description_id, name=payload.name)
    db.add(resume)
    db.flush()
    version = ResumeVersion(student_id=user.id, resume_id=resume.id, version_number=1, content=content, claim_sources=claim_sources)
    db.add(version)
    db.commit()
    db.refresh(resume)
    return {"id": resume.id, "name": resume.name, "version": 1, "content": content, "claim_sources": claim_sources}


@router.get("/{resume_id}/pdf")
def export_pdf(resume_id: UUID, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    resume = db.scalar(select(Resume).where(Resume.id == resume_id, Resume.student_id == user.id))
    if not resume:
        raise HTTPException(404, "Resume not found")
    version = db.scalar(select(ResumeVersion).where(ResumeVersion.resume_id == resume.id, ResumeVersion.student_id == user.id, ResumeVersion.version_number == resume.current_version))
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == user.id))
    if not version:
        raise HTTPException(404, "Resume version not found")
    profile_data = {"full_name": profile.full_name if profile else "", "email": profile.email if profile else "", "phone": profile.phone if profile else "", "location": profile.location if profile else ""}
    pdf = render_resume_pdf(profile_data, version.content)
    path = f"{user.id}/{resume.id}/v{version.version_number}.pdf"
    upload_bytes(settings.supabase_resume_bucket, path, pdf, "application/pdf")
    version.storage_path = path
    db.commit()
    return {"url": signed_url(settings.supabase_resume_bucket, path), "expires_in": 300}
