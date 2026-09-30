from collections.abc import Iterable
from typing import Any

from app.core.config import settings
from app.schemas.contracts import ReadinessResult, RequirementMatch
from app.services.skills import normalize_skill, skill_similarity


def calculate_readiness(
    requirements: list[dict[str, Any]],
    student_skills: Iterable[str],
    evidence_by_skill: dict[str, list[dict[str, Any]]],
) -> ReadinessResult:
    normalized_student = [normalize_skill(s) for s in student_skills]
    if not requirements:
        return ReadinessResult(
            score=0, skill_coverage=0, semantic_relevance=0, evidence_coverage=0, requirements=[]
        )

    matches: list[RequirementMatch] = []
    total_weight = sum(float(req.get("weight", 1)) for req in requirements) or 1.0
    coverage_sum = semantic_sum = evidence_sum = 0.0
    for req in requirements:
        skill = normalize_skill(str(req["skill"]))
        weight = float(req.get("weight", 1))
        ranked = sorted(((skill_similarity(skill, item), item) for item in normalized_student), reverse=True)
        best_similarity, best_skill = ranked[0] if ranked else (0, "")
        evidence = evidence_by_skill.get(best_skill, []) if best_similarity >= 0.62 else []
        if best_similarity >= 0.95:
            classification = "Strong Match"
            coverage = 1.0
        elif best_similarity >= 0.62:
            classification = "Partial Match"
            coverage = 0.5
        else:
            classification = "Missing"
            coverage = 0.0
        coverage_sum += coverage * weight
        semantic_sum += best_similarity * weight
        evidence_sum += (1.0 if evidence else 0.0) * weight
        matches.append(
            RequirementMatch(
                skill=skill,
                classification=classification,
                similarity=round(best_similarity, 3),
                evidence=evidence,
                weight=weight,
                importance=req.get("importance", "required"),
                category=req.get("category", "technical"),
                evidence_expectation=req.get("evidence_expectation") or f"Show where you applied {skill} and what you produced.",
                source_excerpt=req.get("source_excerpt"),
            )
        )

    skill_coverage = coverage_sum / total_weight
    semantic_relevance = semantic_sum / total_weight
    evidence_coverage = evidence_sum / total_weight
    score = 100 * (
        settings.readiness_skill_weight * skill_coverage
        + settings.readiness_semantic_weight * semantic_relevance
        + settings.readiness_evidence_weight * evidence_coverage
    )
    return ReadinessResult(
        score=round(score, 1),
        skill_coverage=round(skill_coverage * 100, 1),
        semantic_relevance=round(semantic_relevance * 100, 1),
        evidence_coverage=round(evidence_coverage * 100, 1),
        requirements=matches,
    )
