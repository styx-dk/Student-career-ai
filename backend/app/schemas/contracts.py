from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    full_name: str = Field(max_length=160)
    headline: str = Field(default="", max_length=240)
    phone: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=160)
    preferred_domains: list[str] = Field(default_factory=list, max_length=10)
    target_role: str | None = Field(default=None, max_length=160)
    preferred_llm_provider: Literal["ollama", "gemini"] | None = None


class ProfileOut(ProfileUpdate, ORMModel):
    id: UUID
    student_id: UUID
    email: str | None = None
    summary: str | None = None
    created_at: datetime
    updated_at: datetime


class CareerRecordCreate(BaseModel):
    record_type: Literal["project", "internship", "certification", "workshop", "achievement", "education", "other"]
    title: str = Field(min_length=1, max_length=240)
    organization: str | None = Field(default=None, max_length=240)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    credential_id: str | None = Field(default=None, max_length=160)
    skills: list[str] = Field(default_factory=list)

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, value: list[str]) -> list[str]:
        return sorted({item.strip() for item in value if item.strip()}, key=str.casefold)


class CareerRecordOut(CareerRecordCreate, ORMModel):
    id: UUID
    evidence_state: str
    source_document_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class SkillInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    proficiency: str | None = Field(default=None, max_length=40)


class SkillOut(ORMModel):
    id: UUID
    name: str
    normalized_name: str
    proficiency: str | None = None
    evidence_state: str
    evidence: list[dict[str, Any]] = Field(default_factory=list)


class CertificateExtraction(BaseModel):
    certificate_name: str | None = None
    issuing_organization: str | None = None
    issue_date: date | None = None
    credential_id: str | None = None
    skills: list[str] = Field(default_factory=list)
    domain: str | None = None
    description: str | None = None


class ProjectExtraction(BaseModel):
    project_name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    skills: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    description: str | None = None


class InternshipExtraction(BaseModel):
    role: str | None = None
    organization: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    skills: list[str] = Field(default_factory=list)
    description: str | None = None


class WorkshopExtraction(BaseModel):
    workshop_name: str | None = None
    organizer: str | None = None
    event_date: date | None = None
    skills: list[str] = Field(default_factory=list)
    description: str | None = None


class AchievementExtraction(BaseModel):
    title: str | None = None
    organization: str | None = None
    achievement_date: date | None = None
    skills: list[str] = Field(default_factory=list)
    description: str | None = None


class StudentProfileExtraction(BaseModel):
    full_name: str | None = None
    headline: str | None = None
    education: list[dict[str, Any]] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)


class JDRequirement(BaseModel):
    skill: str
    importance: Literal["required", "preferred"] = "required"
    weight: float = Field(default=1.0, gt=0, le=5)


class JDRequirementDetail(BaseModel):
    skill: str = Field(min_length=1, max_length=120)
    importance: Literal["required", "preferred"] = "required"
    category: Literal["technical", "tool", "framework", "domain_knowledge", "qualification", "experience", "soft_skill"] = "technical"
    evidence_expectation: str = Field(default="Show where you applied this requirement and what you produced.", max_length=500)
    source_excerpt: str | None = Field(default=None, max_length=500)


class JDAnalysis(BaseModel):
    job_title: str | None = None
    company: str | None = None
    domain: str | None = None
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    qualifications: list[str] = Field(default_factory=list)
    experience_requirements: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    role_characteristics: list[str] = Field(default_factory=list)
    requirements: list[JDRequirementDetail] = Field(default_factory=list, max_length=30)
    general_competencies: list[str] = Field(default_factory=list, max_length=20)


class JDCreate(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    raw_text: str = Field(min_length=20, max_length=100_000)
    job_title: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)


class JDOut(ORMModel):
    id: UUID
    name: str
    job_title: str | None
    company: str | None
    domain: str | None
    source: str
    raw_text: str
    analysis: dict[str, Any]
    requirements: list[dict[str, Any]]
    created_at: datetime


class RequirementMatch(BaseModel):
    skill: str
    classification: Literal["Strong Match", "Partial Match", "Missing", "Not Relevant"]
    similarity: float
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    weight: float
    importance: Literal["required", "preferred"] = "required"
    category: str = "technical"
    evidence_expectation: str = "Show where you applied this requirement and what you produced."
    source_excerpt: str | None = None


class ReadinessResult(BaseModel):
    score: float
    skill_coverage: float
    semantic_relevance: float
    evidence_coverage: float
    requirements: list[RequirementMatch]
    disclaimer: str = "Internal readiness metric; not a hiring or employment probability."


class SimulationRequest(BaseModel):
    job_description_id: UUID
    action_ids: list[UUID] = Field(min_length=1, max_length=20)


class PlanRequest(BaseModel):
    job_description_id: UUID
    target_readiness: float = Field(default=80, gt=0, le=100)
    max_actions: int = Field(default=5, ge=1, le=10)


class ResumeContent(BaseModel):
    professional_summary: str
    skills: list[str] = Field(default_factory=list)
    projects: list[dict[str, Any]] = Field(default_factory=list)
    internships: list[dict[str, Any]] = Field(default_factory=list)
    achievements: list[dict[str, Any]] = Field(default_factory=list)


class ProfileNarrative(BaseModel):
    """Structured first, then rendered as the student's profile narrative."""

    direction: str = Field(min_length=30, max_length=1200)
    documented_work: str = Field(min_length=40, max_length=1800)
    strengths_and_next_steps: str = Field(min_length=40, max_length=1800)


class ExtractionReview(BaseModel):
    decision: Literal["accept", "reject"]
    corrected_result: dict[str, Any] | None = None
