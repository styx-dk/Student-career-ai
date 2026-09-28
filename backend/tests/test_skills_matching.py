from app.services.matching import calculate_readiness
from app.services.skills import normalize_skill, skill_similarity


def test_normalization_is_deterministic():
    assert normalize_skill("  JS ") == "javascript"
    assert normalize_skill("RESTful   API") == "rest api"
    assert skill_similarity("Postgres", "PostgreSQL") == 1.0


def test_readiness_uses_evidence_and_not_hiring_language():
    result = calculate_readiness(
        [{"skill": "Java", "weight": 2}, {"skill": "AWS", "weight": 1}],
        ["java"],
        {"java": [{"type": "project", "title": "Verified project"}]},
    )
    assert 0 < result.score < 100
    assert [item.classification for item in result.requirements] == ["Strong Match", "Missing"]
    assert "not a hiring" in result.disclaimer

