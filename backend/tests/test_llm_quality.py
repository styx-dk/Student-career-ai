import json

import httpx

from app.core.config import AISettings
from app.schemas.contracts import JDAnalysis, JDRequirementDetail
from app.schemas.document_analysis import DocumentAnalysis, SkillEvidence
from app.services import llm
from app.services.role_requirements import clean_extracted_requirements


def test_representative_text_covers_long_document_start_middle_and_end():
    source = "START" + ("a" * 20_000) + "MIDDLE" + ("b" * 20_000) + "END"
    sampled = llm.representative_text(source, 12_000)
    assert "START" in sampled
    assert "MIDDLE" in sampled
    assert "END" in sampled
    assert len(sampled) < 13_000


def test_document_skills_require_source_grounded_evidence():
    result = DocumentAnalysis(
        document_type="project",
        title="API project",
        summary="A small API project.",
        skills=["Python", "Kubernetes"],
        skill_evidence=[
            SkillEvidence(
                skill="Python",
                excerpt="built a REST API using Python",
                attribution="demonstrated",
            ),
            SkillEvidence(
                skill="Kubernetes",
                excerpt="deployed the project with Kubernetes",
                attribution="demonstrated",
            ),
        ],
    )
    grounded = llm.ground_document_analysis(
        result, "The student built a REST API using Python for a class project."
    )
    assert grounded.skills == ["Python"]
    assert "Kubernetes" in grounded.mentioned_skills
    assert [item.skill for item in grounded.skill_evidence] == ["Python"]
    assert any("not present" in warning for warning in grounded.uncertainties)


def test_ollama_repairs_invalid_structured_response_once(monkeypatch):
    payloads = []
    outputs = iter([
        "not valid json",
        json.dumps({"required_skills": ["Python"]}),
    ])

    class FakeClient:
        def __init__(self, **kwargs):
            assert kwargs["timeout"] == 300

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def post(self, *args, **kwargs):
            payloads.append(kwargs["json"])
            return httpx.Response(200, json={"response": next(outputs)})

    monkeypatch.setattr(llm.httpx, "Client", FakeClient)
    provider = llm.OllamaProvider(
        AISettings(_env_file=None, ollama_model="local-test", ollama_num_ctx=8192),
        "local-test",
    )
    result = provider.generate_structured("Analyze this role", JDAnalysis)
    assert result.required_skills == ["Python"]
    assert len(payloads) == 2
    assert payloads[0]["options"]["temperature"] == 0
    assert payloads[0]["options"]["num_ctx"] == 8192
    assert "REPAIR INSTRUCTION" in payloads[1]["prompt"]


def test_role_requirements_omit_model_inventions_and_invalid_quotes():
    analysis = JDAnalysis(
        requirements=[
            JDRequirementDetail(
                skill="Python",
                source_excerpt="Build backend services with Python",
            ),
            JDRequirementDetail(
                skill="Kubernetes",
                source_excerpt="Build backend services with Python",
            ),
        ]
    )
    requirements, _ = clean_extracted_requirements(
        analysis, "You will build backend services with Python and SQL."
    )
    assert [item["skill"] for item in requirements] == ["python"]
    assert requirements[0]["source_excerpt"] == "Build backend services with Python"
