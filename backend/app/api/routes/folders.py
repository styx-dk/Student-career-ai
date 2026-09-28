from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.entities import Folder, Document

router = APIRouter()

class FolderInput(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    parent_id: UUID | None = None

def owned_folder(db, user_id, folder_id):
    folder = db.scalar(select(Folder).where(Folder.id == folder_id, Folder.student_id == user_id))
    if not folder:
        raise HTTPException(404, "Folder not found")
    return folder

@router.get("")
def list_folders(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Folder).where(Folder.student_id == user.id).order_by(Folder.name)).all()

@router.post("", status_code=201)
def create_folder(payload: FolderInput, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not payload.name.strip():
        raise HTTPException(422, "Folder name cannot be blank")
    if payload.parent_id:
        owned_folder(db, user.id, payload.parent_id)
    folder = Folder(student_id=user.id, name=payload.name.strip(), parent_id=payload.parent_id)
    db.add(folder); db.commit(); db.refresh(folder)
    return folder

@router.delete("/{folder_id}", status_code=204)
def delete_folder(folder_id: UUID, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    folder = owned_folder(db, user.id, folder_id)
    if db.scalar(select(Document.id).where(Document.folder_id == folder.id)) or db.scalar(select(Folder.id).where(Folder.parent_id == folder.id)):
        raise HTTPException(409, "Move or delete the folder contents first")
    db.delete(folder); db.commit()
    return Response(status_code=204)
