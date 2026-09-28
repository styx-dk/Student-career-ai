import re
from dataclasses import dataclass
from typing import Literal
from fastapi import Header, HTTPException


@dataclass(frozen=True)
class AISelection:
    provider: str | None = None
    model: str | None = None


def ai_selection(
    x_ai_provider: Literal["gemini", "ollama"] | None = Header(default=None),
    x_ai_model: str | None = Header(default=None, max_length=160),
) -> AISelection:
    model = (x_ai_model or "").strip() or None
    if model and (not x_ai_provider or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}", model)):
        raise HTTPException(422, "Choose a provider and a valid model ID in Settings.")
    if x_ai_provider == "gemini" and model:
        model = model.removeprefix("models/")
        if "/" in model or ":" in model:
            raise HTTPException(422, "Use the Gemini model ID, not a URL.")
    return AISelection(x_ai_provider, model)
