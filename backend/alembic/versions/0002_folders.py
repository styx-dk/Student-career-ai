"""Add student folders and document membership."""
from alembic import op
import sqlalchemy as sa
from app.models.entities import Folder

revision = "0002_folders"
down_revision = "0001_initial"
branch_labels = depends_on = None


def upgrade():
    bind = op.get_bind()
    Folder.__table__.create(bind, checkfirst=True)
    # The initial migration also supports a fresh install with current metadata.
    if "folder_id" not in {c["name"] for c in sa.inspect(bind).get_columns("documents")}:
        op.add_column("documents", sa.Column("folder_id", sa.Uuid(), nullable=True))
        op.create_index("ix_documents_folder_id", "documents", ["folder_id"])
        if bind.dialect.name == "postgresql":
            op.create_foreign_key("fk_documents_folder", "documents", "folders", ["folder_id"], ["id"])
    if bind.dialect.name == "postgresql":
        op.execute('ALTER TABLE folders ENABLE ROW LEVEL SECURITY')
        op.execute('CREATE POLICY folders_owner ON folders FOR ALL TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid())')


def downgrade():
    op.drop_column("documents", "folder_id")
    op.drop_table("folders")
