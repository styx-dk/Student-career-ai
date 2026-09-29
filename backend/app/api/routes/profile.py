from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.career_summary import confirmed_profile, factual_summary, refresh_summary
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.entities import CareerRecord, Education, EvidenceState, StudentProfile, StudentSkill
from app.services.llm import provider_for, public_ai_error
from app.services.ai_selection import AISelection, ai_selection
from app.services.profile_state import load_profile_state
from app.schemas.contracts import ProfileOut, ProfileUpdate
from uuid import UUID


router = APIRouter()

@router.get("/cockpit")
def cockpit(role_id: UUID | None = None, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.career_cockpit import career_cockpit
    return career_cockpit(db, user.id, role_id)

@router.get("/progress")
def progress(offset_minutes: int = Query(0, ge=-840, le=840), user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.student_progress import student_progress
    return student_progress(db, user.id, offset_minutes)

@router.get("/evidence")
def evidence_profile(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    facts = confirmed_profile(db, user.id)
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == user.id))
    summary = profile.summary if profile else None
    if not summary or summary.startswith("Your confirmed profile includes"):
        summary = factual_summary(facts)
    return {**facts, "summary": summary}


@router.get("", response_model=ProfileOut)
def get_profile(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == user.id))
    if profile is None:
        profile = StudentProfile(student_id=user.id, email=user.email, full_name="")
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.put("", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == user.id))
    if profile is None:
        profile = StudentProfile(student_id=user.id, email=user.email)
        db.add(profile)
    for field, value in payload.model_dump().items():
        setattr(profile, field, value)
    db.flush()
    refresh_summary(db, user.id)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/completeness")
def completeness(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == user.id))
    records = db.scalars(select(CareerRecord).where(CareerRecord.student_id == user.id)).all()
    skill_count = len(db.scalars(select(StudentSkill).where(StudentSkill.student_id == user.id)).all())
    types = {record.record_type for record in records}
    education_count = len(db.scalars(select(Education).where(Education.student_id == user.id)).all())
    checks = {
        "personal_information": bool(profile and profile.full_name and profile.headline),
        "education": education_count > 0,
        "skills": skill_count > 0,
        "projects": "project" in types,
        "internships": "internship" in types,
        "certifications": "certification" in types,
        "achievements": "achievement" in types,
    }
    completed = sum(checks.values())
    return {"score": round(completed / len(checks) * 100), "categories": checks}


@router.post("/summary", response_model=ProfileOut)
def generate_summary(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db), selection: AISelection = Depends(ai_selection)):
    profile = db.scalar(select(StudentProfile).where(StudentProfile.student_id == user.id))
    if not profile:
        profile = StudentProfile(student_id=user.id, email=user.email, full_name="")
        db.add(profile)
        db.flush()
    facts = confirmed_profile(db, user.id)
    if not facts["records"]:
        raise HTTPException(409, "Confirm a document before generating a profile summary")
    try:
        profile.summary = provider_for("text", selection.provider, selection.model).generate_profile_summary(facts)
    except Exception as exc:
        raise HTTPException(503, public_ai_error(exc) + " Your confirmed evidence is saved.") from None
    db.commit(); db.refresh(profile)
    return profile
