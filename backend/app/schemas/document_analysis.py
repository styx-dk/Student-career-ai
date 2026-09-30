from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class SkillEvidence(BaseModel):
    """The source passage that caused the model to assign a skill."""

    skill: str = Field(min_length=1, max_length=120)
    excerpt: str = Field(
        min_length=3,
        max_length=500,
        description="A short verbatim excerpt copied from the document",
    )
    attribution: Literal["demonstrated", "awarded", "self_reported", "mentioned"]
    support: Literal["direct", "indirect", "unclear"] = "direct"

    @field_validator("skill", "excerpt")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.split())


class CareerEntry(BaseModel):
    document_type: Literal["project", "internship", "certification", "workshop", "achievement", "education", "other"] = "other"
    title: str = Field(min_length=1, max_length=240)
    summary: str = Field(min_length=1, max_length=6000)
    organization: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    skills: list[str] = Field(default_factory=list, description="Only skills demonstrated or explicitly awarded to the student, never incidental mentions")
    mentioned_skills: list[str] = Field(default_factory=list, description="Mentioned topics that do not establish student capability")
    skill_evidence: list[SkillEvidence] = Field(
        default_factory=list,
        max_length=50,
        description="One source-grounded excerpt for each extracted skill",
    )
    accomplishments: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list, description="Missing attribution, conflicting dates or unclear evidence")

    @field_validator("skills", "mentioned_skills", "accomplishments", "uncertainties")
    @classmethod
    def clean_list(cls, values):
        return list(dict.fromkeys(v.strip() for v in values if v.strip()))

    @field_validator("title", "summary")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("A title and summary are required")
        return value.strip()

    @model_validator(mode="after")
    def ordered_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date")
        return self


class DocumentAnalysis(CareerEntry):
    document_type: Literal["resume", "project", "internship", "certification", "workshop", "achievement", "education", "other"] = "other"
    entries: list[CareerEntry] = Field(default_factory=list, max_length=50, description="For resumes, separate education, projects, internships and credentials into individual entries. Do not turn the entire resume into experience. Attribute skills only to the entry that supports them. Leave empty for a single-purpose document.")
