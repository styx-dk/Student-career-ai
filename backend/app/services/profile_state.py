from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import CareerRecord, Skill, StudentSkill
from app.services.skills import normalize_skill


def load_profile_state(db: Session, student_id: UUID):
    rows = db.execute(
        select(StudentSkill, Skill)
        .join(Skill, StudentSkill.skill_id == Skill.id)
        .where(StudentSkill.student_id == student_id)
    ).all()
    records = db.scalars(select(CareerRecord).where(CareerRecord.student_id == student_id)).all()
    skills = [skill.normalized_name for _, skill in rows]
    skills.extend(normalize_skill(s) for record in records for s in record.skills)
    evidence: dict[str, list[dict]] = {}
    for record in records:
        for skill_name in record.skills:
            normalized = normalize_skill(skill_name)
            evidence.setdefault(normalized, []).append(
                {
                    "id": str(record.id),
                    "type": record.record_type,
                    "title": record.title,
                    "source_document_id": str(record.source_document_id) if record.source_document_id else None,
                }
            )
    return skills, evidence, records
