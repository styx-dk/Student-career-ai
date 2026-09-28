import httpx
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings, get_ai_settings
from app.core.database import engine
from app.services.storage import list_buckets


router = APIRouter()


@router.get("")
def diagnostics():
    ai = get_ai_settings()
    result = {
        "database": "not connected",
        "supabase": "not configured" if not settings.supabase_url else "not connected",
        "storage": "unavailable",
        "ollama": "unavailable",
        "server_ai_provider": ai.llm_provider,
        "server_ai_model": ai.gemini_model if ai.llm_provider == "gemini" else ai.ollama_model,
        "gemini": "configured" if ai.gemini_api_key else "not configured",
        "embeddings": "configured (loads on first use)",
    }
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        result["database"] = "connected"
    except Exception:
        pass
    if settings.supabase_url:
        try:
            buckets = list_buckets()
            result["supabase"] = "connected"
            result["storage"] = "available" if settings.supabase_document_bucket in {b["name"] for b in buckets} else "document bucket missing"
        except Exception:
            pass
    try:
        response = httpx.get(f"{ai.ollama_base_url.rstrip('/')}/api/tags", timeout=2)
        if response.is_success:
            names = [item.get("name", "") for item in response.json().get("models", [])]
            result["ollama"] = "connected" if ai.ollama_model in names else "connected; model missing"
    except Exception:
        pass
    return result
