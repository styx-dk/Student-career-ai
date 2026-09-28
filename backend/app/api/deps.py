from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import Select
from sqlalchemy.orm import Session


def owned_or_404(db: Session, statement: Select, student_id: UUID, message: str = "Record not found"):
    item = db.scalar(statement.where(statement.column_descriptions[0]["entity"].student_id == student_id))
    if item is None:
        raise HTTPException(status_code=404, detail=message)
    return item

