import enum
import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class OwnedMixin:
    student_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)


class EvidenceState(str, enum.Enum):
    claimed = "claimed"
    ai_extracted = "ai_extracted"
    user_confirmed = "user_confirmed"


class ProcessingStatus(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    extracted = "extracted"
    needs_review = "needs_review"
    completed = "completed"
    failed = "failed"


class StudentProfile(Base, TimestampMixin):
    __tablename__ = "student_profiles"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160), default="")
    headline: Mapped[str] = mapped_column(String(240), default="")
    email: Mapped[str | None] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(40))
    location: Mapped[str | None] = mapped_column(String(160))
    summary: Mapped[str | None] = mapped_column(Text)
    preferred_domains: Mapped[list[str]] = mapped_column(JSON, default=list)
    target_role: Mapped[str | None] = mapped_column(String(160))
    preferred_llm_provider: Mapped[str | None] = mapped_column(String(40))


class Education(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "education"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    institution: Mapped[str] = mapped_column(String(200))
    qualification: Mapped[str] = mapped_column(String(200))
    field_of_study: Mapped[str | None] = mapped_column(String(200))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    grade: Mapped[str | None] = mapped_column(String(80))


class Skill(Base, TimestampMixin):
    __tablename__ = "skills"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    normalized_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    domain: Mapped[str | None] = mapped_column(String(120))


class StudentSkill(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "student_skills"
    __table_args__ = (UniqueConstraint("student_id", "skill_id"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"))
    proficiency: Mapped[str | None] = mapped_column(String(40))
    evidence_state: Mapped[EvidenceState] = mapped_column(Enum(EvidenceState), default=EvidenceState.claimed)
    skill: Mapped[Skill] = relationship()


class CareerRecord(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "career_records"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    record_type: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(240))
    organization: Mapped[str | None] = mapped_column(String(240))
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    credential_id: Mapped[str | None] = mapped_column(String(160))
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    evidence_state: Mapped[EvidenceState] = mapped_column(Enum(EvidenceState), default=EvidenceState.claimed)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    __table_args__ = (Index("ix_records_student_type", "student_id", "record_type"),)


class Folder(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "folders"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("folders.id"), index=True)


class Document(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    original_filename: Mapped[str] = mapped_column(String(255))
    folder_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("folders.id"), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(600), unique=True)
    mime_type: Mapped[str] = mapped_column(String(160))
    file_size: Mapped[int] = mapped_column(Integer)
    document_type: Mapped[str] = mapped_column(String(40))
    category: Mapped[str] = mapped_column(String(80), index=True)
    processing_status: Mapped[ProcessingStatus] = mapped_column(
        Enum(ProcessingStatus), default=ProcessingStatus.uploaded
    )
    extraction_error: Mapped[str | None] = mapped_column(Text)
    linked_entity_id: Mapped[uuid.UUID | None]
    linked_entity_type: Mapped[str | None] = mapped_column(String(40))
    current_version: Mapped[int] = mapped_column(Integer, default=1)


class DocumentVersion(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("document_id", "version_number"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    version_number: Mapped[int] = mapped_column(Integer)
    storage_path: Mapped[str] = mapped_column(String(600))
    file_size: Mapped[int] = mapped_column(Integer)


class DocumentExtraction(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "document_extractions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str | None] = mapped_column(String(40))
    raw_text: Mapped[str | None] = mapped_column(Text)
    ai_result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    confirmed_result: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class JobDescription(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "job_descriptions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(240))
    job_title: Mapped[str | None] = mapped_column(String(200))
    company: Mapped[str | None] = mapped_column(String(200))
    domain: Mapped[str | None] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(String(40), default="pasted")
    raw_text: Mapped[str] = mapped_column(Text)
    analysis: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    requirements: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)


class JobPostingHistory(Base, TimestampMixin):
    __tablename__ = "job_posting_history"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    posting_date: Mapped[date] = mapped_column(Date, index=True)
    job_title: Mapped[str] = mapped_column(String(200))
    domain: Mapped[str] = mapped_column(String(120), index=True)
    job_description: Mapped[str] = mapped_column(Text)
    required_skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    source: Mapped[str | None] = mapped_column(String(300))


class SkillDemandHistory(Base, TimestampMixin):
    __tablename__ = "skill_demand_history"
    __table_args__ = (UniqueConstraint("month", "domain", "skill"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    month: Mapped[date] = mapped_column(Date, index=True)
    domain: Mapped[str] = mapped_column(String(120), index=True)
    skill: Mapped[str] = mapped_column(String(120), index=True)
    job_count: Mapped[int] = mapped_column(Integer)
    total_jobs: Mapped[int] = mapped_column(Integer)
    demand_rate: Mapped[float] = mapped_column(Float)


class SkillForecast(Base, TimestampMixin):
    __tablename__ = "skill_forecasts"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    domain: Mapped[str] = mapped_column(String(120), index=True)
    skill: Mapped[str] = mapped_column(String(120), index=True)
    forecast_month: Mapped[date] = mapped_column(Date)
    predicted_rate: Mapped[float] = mapped_column(Float)
    lower_bound: Mapped[float | None] = mapped_column(Float)
    upper_bound: Mapped[float | None] = mapped_column(Float)
    trend: Mapped[str] = mapped_column(String(20))
    model_name: Mapped[str] = mapped_column(String(40), default="ARIMA")
    training_start: Mapped[date | None] = mapped_column(Date)
    training_end: Mapped[date | None] = mapped_column(Date)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class ActionCatalog(Base, TimestampMixin):
    __tablename__ = "action_catalog"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    action_name: Mapped[str] = mapped_column(String(240))
    action_type: Mapped[str] = mapped_column(String(80))
    skills_gained: Mapped[list[str]] = mapped_column(JSON, default=list)
    related_domain: Mapped[str | None] = mapped_column(String(120), index=True)
    effort_cost: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SimulationResult(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "simulation_results"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    job_description_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_descriptions.id", ondelete="CASCADE"))
    action_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    baseline_score: Mapped[float] = mapped_column(Float)
    simulated_score: Mapped[float] = mapped_column(Float)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class CareerPlan(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "career_plans"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    job_description_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_descriptions.id", ondelete="CASCADE"))
    target_role: Mapped[str] = mapped_column(String(200))
    current_readiness: Mapped[float] = mapped_column(Float)
    target_readiness: Mapped[float] = mapped_column(Float)
    selected_actions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    remaining_gaps: Mapped[list[str]] = mapped_column(JSON, default=list)


class Resume(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "resumes"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    job_description_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("job_descriptions.id"))
    name: Mapped[str] = mapped_column(String(240))
    current_version: Mapped[int] = mapped_column(Integer, default=1)


class ResumeVersion(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "resume_versions"
    __table_args__ = (UniqueConstraint("resume_id", "version_number"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    resume_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"))
    version_number: Mapped[int] = mapped_column(Integer)
    content: Mapped[dict[str, Any]] = mapped_column(JSON)
    claim_sources: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    storage_path: Mapped[str | None] = mapped_column(String(600))


class ActivityLog(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "activity_log"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str | None] = mapped_column(String(80))
    entity_id: Mapped[uuid.UUID | None]
    message: Mapped[str] = mapped_column(String(500))
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class ContentEmbedding(Base, TimestampMixin, OwnedMixin):
    __tablename__ = "content_embeddings"
    __table_args__ = (UniqueConstraint("student_id", "entity_type", "entity_id", "content_hash"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(index=True)
    content_hash: Mapped[str] = mapped_column(String(64))
    embedding: Mapped[list[float]] = mapped_column(Vector(384))
