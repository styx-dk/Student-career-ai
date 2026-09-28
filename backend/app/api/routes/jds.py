from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.entities import JobDescription
from app.schemas.contracts import JDCreate, JDOut, ReadinessResult
from app.services.llm import provider_for
from app.services.matching import calculate_readiness
from app.services.profile_state import load_profile_state
from app.services.skills import normalize_skill
from app.services.documents import extract_text, validate_upload
from app.core.config import settings
from pathlib import Path


router = APIRouter()


@router.get("", response_model=list[JDOut])
def list_jds(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(JobDescription).where(JobDescription.student_id == user.id).order_by(JobDescription.created_at.desc())
    ).all()


@router.post("", response_model=JDOut, status_code=201)
def create_jd(payload: JDCreate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    jd = JobDescription(student_id=user.id, **payload.model_dump())
    db.add(jd)
    db.commit()
    db.refresh(jd)
    return jd


@router.post("/upload", response_model=JDOut, status_code=201)
async def upload_jd(
    file: UploadFile = File(...),
    name: str = Form(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = await file.read(settings.max_upload_bytes + 1)
    extension = validate_upload(
        file.filename or "job-description", file.content_type or "", len(data), settings.max_upload_bytes
    )
    if extension not in {".pdf", ".docx", ".txt"}:
        raise HTTPException(415, "Job description uploads support PDF, DOCX and TXT")
    text, scanned = extract_text(data, extension)
    if scanned or len(text) < 20:
        raise HTTPException(422, "The job description does not contain enough extractable text")
    jd = JobDescription(
        student_id=user.id,
        name=name,
        raw_text=text,
        source=f"upload:{Path(file.filename or 'job-description').name}",
    )
    db.add(jd); db.commit(); db.refresh(jd)
    return jd


@router.post("/{jd_id}/analyze", response_model=JDOut)
def analyze_jd(jd_id: UUID, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    jd = db.scalar(select(JobDescription).where(JobDescription.id == jd_id, JobDescription.student_id == user.id))
    if not jd:
        raise HTTPException(404, "Job description not found")
    try:
        result = provider_for("text").analyze_jd(jd.raw_text)
    except Exception as exc:
        raise HTTPException(503, f"JD analysis provider unavailable: {exc}") from exc
    jd.analysis = result.model_dump(mode="json")
    jd.job_title = result.job_title or jd.job_title
    jd.company = result.company or jd.company
    jd.domain = result.domain
    required = [{"skill": normalize_skill(s), "importance": "required", "weight": 2.0} for s in result.required_skills]
    preferred = [{"skill": normalize_skill(s), "importance": "preferred", "weight": 1.0} for s in result.preferred_skills]
    deduped = {item["skill"]: item for item in preferred + required}
    jd.requirements = list(deduped.values())
    db.commit()
    db.refresh(jd)
    return jd


@router.get("/{jd_id}/match", response_model=ReadinessResult)
def match_jd(jd_id: UUID, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    jd = db.scalar(select(JobDescription).where(JobDescription.id == jd_id, JobDescription.student_id == user.id))
    if not jd:
        raise HTTPException(404, "Job description not found")
    if not jd.requirements:
        raise HTTPException(409, "Analyze the job description before matching")
    skills, evidence, _ = load_profile_state(db, user.id)
    return calculate_readiness(jd.requirements, skills, evidence)


@router.delete("/{jd_id}", status_code=204)
def delete_jd(jd_id: UUID, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    jd = db.scalar(select(JobDescription).where(JobDescription.id == jd_id, JobDescription.student_id == user.id))
    if not jd:
        raise HTTPException(404, "Job description not found")
    db.delete(jd)
    db.commit()
    return Response(status_code=204)
