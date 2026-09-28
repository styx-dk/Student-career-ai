from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.entities import CareerRecord, EvidenceState, Skill, StudentSkill
from app.schemas.contracts import CareerRecordCreate, CareerRecordOut, SkillInput
from app.services.skills import normalize_skill
from app.services.career_summary import refresh_summary


router = APIRouter()


@router.get("/timeline")
def timeline(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.scalars(
        select(CareerRecord).where(
            CareerRecord.student_id == user.id,
            CareerRecord.start_date.is_not(None),
        ).order_by(CareerRecord.start_date.desc())
    ).all()
    years: dict[int, list[dict]] = {}
    for record in records:
        years.setdefault(record.start_date.year, []).append(
            {"id": record.id, "type": record.record_type, "title": record.title, "date": record.start_date}
        )
    return [{"year": year, "events": events} for year, events in years.items()]


@router.get("", response_model=list[CareerRecordOut])
def list_records(
    record_type: str | None = None,
    search: str | None = Query(default=None, max_length=100),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(CareerRecord).where(CareerRecord.student_id == user.id)
    if record_type:
        query = query.where(CareerRecord.record_type == record_type)
    if search:
        term = f"%{search}%"
        query = query.where(or_(CareerRecord.title.ilike(term), CareerRecord.description.ilike(term)))
    return db.scalars(query.order_by(CareerRecord.start_date.desc(), CareerRecord.created_at.desc())).all()


@router.post("", response_model=CareerRecordOut, status_code=201)
def create_record(
    payload: CareerRecordCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = CareerRecord(
        student_id=user.id,
        evidence_state=EvidenceState.claimed,
        **payload.model_dump(),
    )
    db.add(record)
    _upsert_skills(db, user.id, payload.skills, EvidenceState.claimed)
    db.commit()
    db.refresh(record)
    return record


@router.put("/items/{record_id}", response_model=CareerRecordOut)
def update_record(
    record_id: UUID,
    payload: CareerRecordCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.scalar(
        select(CareerRecord).where(CareerRecord.id == record_id, CareerRecord.student_id == user.id)
    )
    if not record:
        raise HTTPException(404, "Record not found")
    for field, value in payload.model_dump().items():
        setattr(record, field, value)
    _upsert_skills(db, user.id, payload.skills, record.evidence_state)
    db.flush()
    refresh_summary(db, user.id)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/items/{record_id}", status_code=204)
def delete_record(
    record_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.scalar(
        select(CareerRecord).where(CareerRecord.id == record_id, CareerRecord.student_id == user.id)
    )
    if not record:
        raise HTTPException(404, "Record not found")
    db.delete(record)
    db.flush()
    refresh_summary(db, user.id)
    db.commit()
    return Response(status_code=204)


@router.get("/skills")
def list_skills(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(StudentSkill, Skill)
        .join(Skill, StudentSkill.skill_id == Skill.id)
        .where(StudentSkill.student_id == user.id)
        .order_by(Skill.name)
    ).all()
    records = db.scalars(select(CareerRecord).where(CareerRecord.student_id == user.id)).all()
    return [
        {
            "id": student_skill.id,
            "name": skill.name,
            "normalized_name": skill.normalized_name,
            "proficiency": student_skill.proficiency,
            "evidence_state": student_skill.evidence_state,
            "evidence": [
                {"id": str(record.id), "type": record.record_type, "title": record.title}
                for record in records
                if skill.normalized_name in {normalize_skill(item) for item in record.skills}
            ],
        }
        for student_skill, skill in rows
    ]


@router.post("/skills", status_code=201)
def add_skill(
    payload: SkillInput,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student_skill = _upsert_skills(db, user.id, [payload.name], EvidenceState.claimed)[0]
    student_skill.proficiency = payload.proficiency
    db.commit()
    return {"id": student_skill.id, "name": payload.name, "evidence_state": "claimed"}


def _upsert_skills(db: Session, student_id: UUID, names: list[str], state: EvidenceState):
    result = []
    seen = set()
    for name in names:
        normalized = normalize_skill(name)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        skill = db.scalar(select(Skill).where(Skill.normalized_name == normalized))
        if not skill:
            skill = Skill(name=name.strip(), normalized_name=normalized)
            db.add(skill)
            db.flush()
        student_skill = db.scalar(
            select(StudentSkill).where(
                StudentSkill.student_id == student_id, StudentSkill.skill_id == skill.id
            )
        )
        if not student_skill:
            student_skill = StudentSkill(student_id=student_id, skill_id=skill.id, evidence_state=state)
            db.add(student_skill)
        elif state == EvidenceState.user_confirmed:
            student_skill.evidence_state = state
        result.append(student_skill)
    return result
