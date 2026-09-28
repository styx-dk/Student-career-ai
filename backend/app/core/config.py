from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class AISettings(BaseSettings):
    """Read fresh for each AI operation; other server settings remain startup-only."""
    model_config = SettingsConfigDict(env_file=ROOT_ENV, env_file_encoding="utf-8", extra="ignore")
    llm_provider: Literal["ollama", "gemini"] = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"
    gemini_api_key: str = Field(default="", repr=False)
    gemini_model: str = ""


def get_ai_settings() -> AISettings:
    try:
        return AISettings()
    except Exception:
        raise RuntimeError("Invalid AI configuration. Check LLM_PROVIDER and model settings in the root .env.") from None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_ENV, env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Career Compass API"
    app_env: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"
    backend_cors_origins: str = "http://localhost:5173"
    database_url: str = "sqlite:///./career_compass_dev.db"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_audience: str = "authenticated"
    supabase_document_bucket: str = "career-documents"
    supabase_resume_bucket: str = "generated-resumes"
    max_upload_mb: int = Field(default=20, ge=1, le=100)

    llm_provider: Literal["ollama", "gemini"] = "ollama"
    llm_fallback_provider: Literal["", "ollama", "gemini"] = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"
    gemini_api_key: str = ""
    gemini_model: str = ""
    embedding_model: str = "all-MiniLM-L6-v2"

    readiness_skill_weight: float = 0.55
    readiness_semantic_weight: float = 0.20
    readiness_evidence_weight: float = 0.25
    forecast_horizon_months: int = Field(default=6, ge=1, le=12)

    @field_validator("database_url", mode="before")
    @classmethod
    def use_psycopg3_driver(cls, value: str) -> str:
        """Accept standard Supabase/Postgres URLs while using the installed Psycopg 3 driver."""
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @model_validator(mode="after")
    def validate_weights(self):
        total = self.readiness_skill_weight + self.readiness_semantic_weight + self.readiness_evidence_weight
        if abs(total - 1.0) > 0.001:
            raise ValueError("Readiness weights must total 1.0")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
