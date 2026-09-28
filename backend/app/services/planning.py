from dataclasses import dataclass
from typing import Any

from app.schemas.contracts import ReadinessResult
from app.services.matching import calculate_readiness
from app.services.skills import normalize_skill


@dataclass(frozen=True)
class CandidateAction:
    id: str
    name: str
    skills: tuple[str, ...]
    effort: float
    action_type: str
    description: str


def simulate(
    requirements: list[dict[str, Any]],
    current_skills: list[str],
    evidence: dict[str, list[dict[str, Any]]],
    actions: list[CandidateAction],
) -> tuple[ReadinessResult, ReadinessResult]:
    baseline = calculate_readiness(requirements, current_skills, evidence)
    simulated_skills = list(current_skills)
    simulated_evidence = {key: list(value) for key, value in evidence.items()}
    for action in actions:
        for skill in action.skills:
            normalized = normalize_skill(skill)
            simulated_skills.append(normalized)
            simulated_evidence.setdefault(normalized, []).append(
                {"type": "simulation", "title": action.name, "hypothetical": True}
            )
    return baseline, calculate_readiness(requirements, simulated_skills, simulated_evidence)


def greedy_plan(
    requirements: list[dict[str, Any]],
    current_skills: list[str],
    evidence: dict[str, list[dict[str, Any]]],
    candidates: list[CandidateAction],
    target: float,
    max_actions: int,
    forecast_signals: dict[str, float] | None = None,
) -> dict[str, Any]:
    baseline = calculate_readiness(requirements, current_skills, evidence)
    selected: list[CandidateAction] = []
    skills = list(current_skills)
    simulated_evidence = {key: list(value) for key, value in evidence.items()}
    current = baseline
    remaining = list(candidates)
    signals = forecast_signals or {}

    while current.score < target and remaining and len(selected) < max_actions:
        ranked: list[tuple[float, float, CandidateAction, ReadinessResult]] = []
        for action in remaining:
            _, result = simulate(requirements, skills, simulated_evidence, [action])
            direct_gain = max(result.score - current.score, 0)
            forecast_bonus = sum(max(signals.get(normalize_skill(s), 0), 0) for s in action.skills)
            efficiency = (direct_gain + 0.1 * forecast_bonus) / max(action.effort, 0.1)
            ranked.append((efficiency, direct_gain, action, result))
        efficiency, gain, chosen, result = max(ranked, key=lambda item: (item[0], item[1]))
        if efficiency <= 0 or gain <= 0:
            break
        selected.append(chosen)
        remaining.remove(chosen)
        for skill in chosen.skills:
            normalized = normalize_skill(skill)
            skills.append(normalized)
            simulated_evidence.setdefault(normalized, []).append(
                {"type": "simulation", "title": chosen.name, "hypothetical": True}
            )
        current = result

    return {
        "current_readiness": baseline.score,
        "projected_readiness": current.score,
        "target_readiness": target,
        "target_reached": current.score >= target,
        "actions": [
            {
                "id": action.id,
                "name": action.name,
                "type": action.action_type,
                "skills_covered": list(action.skills),
                "effort_cost": action.effort,
                "reason": "Efficiently covers currently missing target-role requirements.",
            }
            for action in selected
        ],
        "remaining_gaps": [
            req.skill for req in current.requirements if req.classification == "Missing"
        ],
    }

