"""Turn LLM output into concrete, evidence-oriented role requirements."""
import re
from typing import Any
from app.services.skills import normalize_skill


VAGUE_PATTERNS = (
    r"^core programming languages?$", r"^programming languages?$", r"^technical skills?$",
    r"^problem[- ]solving( abilities| skills)?$", r"^logical thinking$", r"^attention to detail$",
    r"^(team )?communication( skills)?$", r"^teamwork$", r"^analytical skills?$",
    r"^interpersonal skills?$", r"^strong work ethic$", r"^fast learner$",
)
SOFT_PATTERNS = ("communication", "teamwork", "collaboration", "attention to detail", "problem solving", "logical thinking")


def _canonical(value: str) -> str:
    text = normalize_skill(value)
    if "version control" in text and re.search(r"\bgit\b", text):
        return "git"
    text = re.sub(r"^(knowledge of|experience with|proficiency in|familiarity with)\s+", "", text)
    return normalize_skill(text.strip(" .,:;"))


def is_vague(value: str) -> bool:
    skill = _canonical(value)
    return not skill or any(re.fullmatch(pattern, skill) for pattern in VAGUE_PATTERNS)


def clean_extracted_requirements(analysis) -> tuple[list[dict[str, Any]], list[str]]:
    details = list(analysis.requirements)
    if not details:
        details = []
        for name in analysis.required_skills:
            details.append({"skill": name, "importance": "required", "category": "technical"})
        for name in analysis.preferred_skills:
            details.append({"skill": name, "importance": "preferred", "category": "technical"})
        for name in analysis.technologies:
            details.append({"skill": name, "importance": "preferred", "category": "tool"})
    accepted, competencies, seen = [], list(analysis.general_competencies), set()
    for raw in details:
        item = raw.model_dump() if hasattr(raw, "model_dump") else dict(raw)
        skill = _canonical(str(item.get("skill", "")))
        category = item.get("category", "technical")
        if category == "soft_skill" or is_vague(skill):
            if skill and skill not in competencies:
                competencies.append(skill)
            continue
        if skill in seen:
            # Required wins over preferred, while keeping the richer explanation.
            if item.get("importance") == "required":
                next(row for row in accepted if row["skill"] == skill)["importance"] = "required"
            continue
        seen.add(skill)
        importance = item.get("importance", "required")
        accepted.append({"skill": skill, "label": skill, "importance": importance,
            "weight": 2.0 if importance == "required" else 1.0, "category": category,
            "evidence_expectation": item.get("evidence_expectation") or f"Show a project or experience where you applied {skill} and explain the result.",
            "source_excerpt": item.get("source_excerpt")})
    return accepted[:25], list(dict.fromkeys(str(v).strip() for v in competencies if str(v).strip()))[:20]


def review_stored_requirements(requirements: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    accepted, excluded, seen = [], [], set()
    for raw in requirements or []:
        skill = _canonical(str(raw.get("skill", "")))
        if is_vague(skill) or any(term in skill for term in SOFT_PATTERNS):
            if skill:
                excluded.append(skill)
            continue
        if skill in seen:
            continue
        seen.add(skill)
        item = dict(raw)
        item.update({"skill": skill, "label": item.get("label") or skill,
            "category": item.get("category", "domain_knowledge" if skill in {"algorithms", "data structures"} else "technical"),
            "evidence_expectation": item.get("evidence_expectation") or f"Show a project or experience where you applied {skill} and explain the result."})
        accepted.append(item)
    return accepted, excluded
