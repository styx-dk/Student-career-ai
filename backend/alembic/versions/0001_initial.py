"""Initial career repository schema and Supabase RLS policies.

Revision ID: 0001_initial
"""
from alembic import op
from sqlalchemy import inspect

from app.core.database import Base
from app.models import entities  # noqa: F401


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


OWNED_TABLES = [
    "student_profiles", "education", "student_skills", "career_records", "documents",
    "document_versions", "document_extractions", "job_descriptions", "simulation_results",
    "career_plans", "resumes", "resume_versions", "activity_log", "content_embeddings",
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name == "postgresql":
        for table in OWNED_TABLES:
            op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
            op.execute(
                f'''CREATE POLICY "owner_select_{table}" ON "{table}" FOR SELECT
                    USING (student_id = auth.uid())'''
            )
            op.execute(
                f'''CREATE POLICY "owner_insert_{table}" ON "{table}" FOR INSERT
                    WITH CHECK (student_id = auth.uid())'''
            )
            op.execute(
                f'''CREATE POLICY "owner_update_{table}" ON "{table}" FOR UPDATE
                    USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid())'''
            )
            op.execute(
                f'''CREATE POLICY "owner_delete_{table}" ON "{table}" FOR DELETE
                    USING (student_id = auth.uid())'''
            )


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)

