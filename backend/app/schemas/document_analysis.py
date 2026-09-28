from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class DocumentAnalysis(BaseModel):
    document_type: Literal["project", "internship", "certification", "workshop", "achievement", "education", "other"] = "other"
    title: str = Field(min_length=1, max_length=240)
    summary: str = Field(min_length=1, max_length=6000)
    organization: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    skills: list[str] = Field(default_factory=list, description="Only skills demonstrated or explicitly awarded to the student, never incidental mentions")
    mentioned_skills: list[str] = Field(default_factory=list, description="Mentioned topics that do not establish student capability")
    accomplishments: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list, description="Missing attribution, conflicting dates or unclear evidence")

    @field_validator("skills", "mentioned_skills", "accomplishments", "uncertainties")
    @classmethod
    def clean_list(cls, values):
        return list(dict.fromkeys(v.strip() for v in values if v.strip()))
