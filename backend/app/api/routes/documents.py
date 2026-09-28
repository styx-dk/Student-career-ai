import uuid
import logging
import hashlib
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.entities import CareerRecord, Document, DocumentExtraction, DocumentVersion, EvidenceState, ProcessingStatus
from app.schemas.contracts import ExtractionReview
from app.schemas.document_analysis import DocumentAnalysis
from app.services.documents import IMAGE_EXTENSIONS, extract_text, safe_filename, validate_upload
from app.services.llm import provider_for, public_ai_error
from app.services.ai_selection import AISelection, ai_selection
from app.services.storage import download_bytes, remove_object, signed_url, upload_bytes
from app.api.routes.folders import owned_folder
from app.services.career_summary import refresh_summary

router = APIRouter()
logger = logging.getLogger(__name__)

def owned_document(db, user_id, document_id):
    document = db.scalar(select(Document).where(Document.id == document_id, Document.student_id == user_id))
    if not document:
        raise HTTPException(404, "Document not found")
    return document

def latest_extraction(db, user_id, document_id):
    return db.scalar(select(DocumentExtraction).where(
        DocumentExtraction.document_id == document_id, DocumentExtraction.student_id == user_id
    ).order_by(DocumentExtraction.created_at.desc(), DocumentExtraction.id.desc()))

def serialize(document, extraction=None):
    return {
        "id": document.id, "folder_id": document.folder_id,
        "original_filename": document.original_filename, "display_name": document.display_name,
        "mime_type": document.mime_type, "file_size": document.file_size,
        "document_type": document.document_type, "category": document.category,
        "processing_status": document.processing_status, "extraction_error": document.extraction_error,
        "current_version": document.current_version, "created_at": document.created_at,
        "extraction": extraction.ai_result if extraction else None,
        "confirmed_result": extraction.confirmed_result if extraction else None,
        "is_confirmed": extraction.is_confirmed if extraction else False,
    }

@router.get("")
def list_documents(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    documents = db.scalars(select(Document).where(Document.student_id == user.id).order_by(Document.created_at.desc())).all()
    extractions = db.scalars(select(DocumentExtraction).where(DocumentExtraction.student_id == user.id)
        .order_by(DocumentExtraction.created_at.desc(), DocumentExtraction.id.desc())).all()
    latest = {}
    confirmed = set()
    for extraction in extractions:
        latest.setdefault(extraction.document_id, extraction)
        if extraction.is_confirmed:
            confirmed.add(extraction.document_id)
    return [{**serialize(doc, latest.get(doc.id)), "has_confirmed_evidence": doc.id in confirmed} for doc in documents]

@router.get("/{document_id}")
def get_document(document_id: UUID, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = owned_document(db, user.id, document_id)
    confirmed = db.scalar(select(CareerRecord.id).where(CareerRecord.student_id == user.id,
        CareerRecord.source_document_id == doc.id, CareerRecord.evidence_state == EvidenceState.user_confirmed))
    return {**serialize(doc, latest_extraction(db, user.id, doc.id)), "has_confirmed_evidence": confirmed is not None}

@router.post("", status_code=201)
async def upload_document(file: UploadFile = File(...), folder_id: UUID | None = Form(None),
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if folder_id:
        owned_folder(db, user.id, folder_id)
    data = await file.read(settings.max_upload_bytes + 1)
    extension = validate_upload(file.filename or "document", file.content_type or "", len(data), settings.max_upload_bytes)
    name = safe_filename(file.filename or "document")
    # New uploads encode their exact byte digest in the private storage path.
    # This is owner-scoped and needs no remote schema migration.
    digest = hashlib.sha256(data).hexdigest()
    existing = db.scalar(select(Document).where(Document.student_id == user.id,
        Document.storage_path.like(f"%/v1/{digest}/%")))
    if existing:
        return {**serialize(existing, latest_extraction(db, user.id, existing.id)), "duplicate": True}
    document_id = uuid.uuid4()
    path = f"{user.id}/{document_id}/v1/{digest}/{name}"
    try:
        upload_bytes(settings.supabase_document_bucket, path, data, file.content_type)
    except Exception as exc:
        logger.warning("Document upload storage failure (%s)", type(exc).__name__)
        raise HTTPException(503, "We couldn’t save this file. Please try again shortly. If the issue continues, check Storage in Settings.")
    try:
        document = Document(id=document_id, student_id=user.id, folder_id=folder_id,
            original_filename=name, display_name=name, storage_path=path,
            mime_type=file.content_type, file_size=len(data), document_type=extension[1:],
            category="other", processing_status=ProcessingStatus.uploaded)
        db.add(document); db.flush()
        db.add(DocumentVersion(student_id=user.id, document_id=document.id, version_number=1, storage_path=path, file_size=len(data)))
        db.commit()
        return serialize(document)
    except Exception:
        db.rollback(); remove_object(settings.supabase_document_bucket, path)
        raise

class DocumentUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    folder_id: UUID | None = None

@router.patch("/{document_id}")
def update_document(document_id: UUID, payload: DocumentUpdate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = owned_document(db, user.id, document_id)
    if payload.folder_id:
        owned_folder(db, user.id, payload.folder_id)
    doc.display_name = payload.display_name.strip() or doc.display_name
    doc.folder_id = payload.folder_id
    db.commit()
    return serialize(doc, latest_extraction(db, user.id, doc.id))

@router.post("/{document_id}/process")
def process_document(document_id: UUID, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db), selection: AISelection = Depends(ai_selection)):
    document = owned_document(db, user.id, document_id)
    document.processing_status = ProcessingStatus.processing
    document.extraction_error = None
    db.commit()
    try:
        data = download_bytes(settings.supabase_document_bucket, document.storage_path)
        extension = Path(document.original_filename).suffix.lower()
        raw_text = None
        if extension in IMAGE_EXTENSIONS:
            provider = provider_for("image", selection.provider, selection.model)
            result = provider.analyze_image_document(data, document.mime_type, DocumentAnalysis)
        else:
            raw_text, scanned = extract_text(data, extension)
            if scanned and extension == ".pdf":
                provider = provider_for("image", selection.provider, selection.model)
                result = provider.analyze_image_document(data, "application/pdf", DocumentAnalysis)
            else:
                if not raw_text.strip():
                    raise ValueError("No readable text found")
                if len(raw_text) > 50000:
                    raise ValueError("Document exceeds the 50,000-character analysis limit. Split it into smaller files.")
                provider = provider_for("text", selection.provider, selection.model)
                result = provider.analyze_text_document(raw_text, DocumentAnalysis)
        extraction = DocumentExtraction(student_id=user.id, document_id=document.id,
            provider=provider.name, raw_text=raw_text, ai_result=result.model_dump(mode="json"))
        db.add(extraction)
        document.processing_status = ProcessingStatus.needs_review
        db.commit()
        return serialize(document, extraction)
    except Exception as exc:
        message = str(exc) if isinstance(exc, ValueError) and not isinstance(exc, ValidationError) else public_ai_error(exc)
        if settings.gemini_api_key and settings.gemini_api_key in message:
            message = "Analysis failed. Check the provider connection and retry."
        document.processing_status = ProcessingStatus.failed
        document.extraction_error = message[:500]
        db.commit()
        raise HTTPException(422, document.extraction_error)

@router.post("/{document_id}/review")
def review_extraction(document_id: UUID, payload: ExtractionReview, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    document = owned_document(db, user.id, document_id)
    extraction = latest_extraction(db, user.id, document.id)
    if not extraction:
        raise HTTPException(404, "Analyze the document first")
    if payload.decision == "reject":
        if extraction.is_confirmed:
            raise HTTPException(409, "This revision is already confirmed. Reanalyze to create a new draft.")
        from app.models.entities import utcnow
        extraction.rejected_at = utcnow()
        document.processing_status = ProcessingStatus.extracted
        db.commit()
        return {"status": "rejected"}
    try:
        result = DocumentAnalysis.model_validate(payload.corrected_result if payload.corrected_result is not None else extraction.ai_result)
    except ValidationError:
        raise HTTPException(422, "Please check the title, summary, dates and skill fields")
    extraction.confirmed_result = result.model_dump(mode="json")
    extraction.is_confirmed = True
    extraction.rejected_at = None
    records = db.scalars(select(CareerRecord).where(CareerRecord.student_id == user.id, CareerRecord.source_document_id == document.id)).all()
    record = records[0] if records else CareerRecord(id=uuid.uuid4(), student_id=user.id, source_document_id=document.id)
    for duplicate in records[1:]:
        db.delete(duplicate)
    record.record_type = result.document_type
    record.title = result.title
    record.organization = result.organization
    record.description = result.summary
    record.start_date = result.start_date
    record.end_date = result.end_date
    record.skills = result.skills
    record.metadata_json = {"accomplishments": result.accomplishments, "uncertainties": result.uncertainties}
    record.evidence_state = EvidenceState.user_confirmed
    db.add(record)
    document.linked_entity_id = record.id
    document.linked_entity_type = result.document_type
    document.category = result.document_type
    document.processing_status = ProcessingStatus.completed
    db.flush(); refresh_summary(db, user.id); db.commit()
    return {"status": "accepted", "record_id": record.id}

@router.get("/{document_id}/download")
def download_document(document_id: UUID, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = owned_document(db, user.id, document_id)
    return {"url": signed_url(settings.supabase_document_bucket, doc.storage_path), "expires_in": 300}

@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: UUID, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = owned_document(db, user.id, document_id)
    versions = db.scalars(select(DocumentVersion).where(DocumentVersion.document_id == doc.id, DocumentVersion.student_id == user.id)).all()
    for path in {doc.storage_path, *(v.storage_path for v in versions)}:
        remove_object(settings.supabase_document_bucket, path)
    for model, condition in [(CareerRecord, CareerRecord.source_document_id == doc.id), (DocumentExtraction, DocumentExtraction.document_id == doc.id), (DocumentVersion, DocumentVersion.document_id == doc.id)]:
        for row in db.scalars(select(model).where(condition, model.student_id == user.id)).all():
            db.delete(row)
    db.delete(doc); db.flush(); refresh_summary(db, user.id); db.commit()
    return Response(status_code=204)
