import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Literal

from app.core.config import get_ai_settings
from app.core.security import CurrentUser, get_current_user
from app.services.ai_selection import AISelection, ai_selection
from app.services.llm import provider_for, check_response, public_ai_error

router = APIRouter()


@router.get("/config")
def config(user: CurrentUser = Depends(get_current_user), selection: AISelection = Depends(ai_selection)):
    try:
        settings = get_ai_settings()
        provider = selection.provider or settings.llm_provider
        model = selection.model or (settings.gemini_model if provider == "gemini" else settings.ollama_model)
        return {
            "provider": provider, "model": model,
            "source": "browser preference" if selection.provider else "server .env",
            "default_provider": settings.llm_provider,
            "gemini_model": settings.gemini_model, "ollama_model": settings.ollama_model,
            "gemini_configured": bool(settings.gemini_api_key),
            "image_support": provider == "gemini",
        }
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from None


@router.get("/models")
def models(provider: Literal["gemini", "ollama"] = Query(...), user: CurrentUser = Depends(get_current_user)):
    try:
        settings = get_ai_settings()
        result = []
        with httpx.Client(timeout=15) as client:
            if provider == "gemini":
                if not settings.gemini_api_key:
                    raise RuntimeError("Add GEMINI_API_KEY to the server .env before listing Gemini models.")
                token = None
                while True:
                    response = client.get("https://generativelanguage.googleapis.com/v1beta/models",
                        headers={"x-goog-api-key": settings.gemini_api_key},
                        params={"pageSize": 1000, **({"pageToken": token} if token else {})})
                    check_response(response, provider, "model list")
                    data = response.json()
                    result.extend({"id": m["name"].removeprefix("models/"), "label": m.get("displayName", m["name"])}
                        for m in data.get("models", []) if "generateContent" in m.get("supportedGenerationMethods", []))
                    token = data.get("nextPageToken")
                    if not token:
                        break
            else:
                response = client.get(f"{settings.ollama_base_url.rstrip('/')}/api/tags")
                check_response(response, provider, "model list")
                result = [{"id": m["name"], "label": m["name"]} for m in response.json().get("models", [])]
        return {"provider": provider, "models": sorted(result, key=lambda m: m["id"])}
    except Exception as exc:
        raise HTTPException(503, public_ai_error(exc)) from None


class ProbeResult(BaseModel):
    status: str


@router.post("/test")
def test_connection(user: CurrentUser = Depends(get_current_user), selection: AISelection = Depends(ai_selection)):
    try:
        provider = provider_for("text", selection.provider, selection.model)
        provider.generate_structured('Connection test only. Return {"status":"ok"}. No student data is supplied.', ProbeResult)
        return {"provider": provider.name, "model": provider.model, "message": "Structured generation succeeded. This model can respond in the format the app needs."}
    except Exception as exc:
        raise HTTPException(503, public_ai_error(exc)) from None
