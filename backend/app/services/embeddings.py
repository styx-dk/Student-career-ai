import hashlib
from functools import lru_cache
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import ContentEmbedding


@lru_cache(maxsize=1)
def _model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(settings.embedding_model)


def embed_text(text: str) -> list[float]:
    return _model().encode(text, normalize_embeddings=True).tolist()


def cached_embedding(
    db: Session, student_id: UUID, entity_type: str, entity_id: UUID, text: str
) -> ContentEmbedding:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    existing = db.scalar(
        select(ContentEmbedding).where(
            ContentEmbedding.student_id == student_id,
            ContentEmbedding.entity_type == entity_type,
            ContentEmbedding.entity_id == entity_id,
            ContentEmbedding.content_hash == digest,
        )
    )
    if existing:
        return existing
    row = ContentEmbedding(
        student_id=student_id,
        entity_type=entity_type,
        entity_id=entity_id,
        content_hash=digest,
        embedding=embed_text(text),
    )
    db.add(row)
    db.flush()
    return row


def semantic_search(db: Session, student_id: UUID, query: str, limit: int = 8):
    vector = embed_text(query)
    return db.scalars(
        select(ContentEmbedding)
        .where(ContentEmbedding.student_id == student_id)
        .order_by(ContentEmbedding.embedding.cosine_distance(vector))
        .limit(limit)
    ).all()

