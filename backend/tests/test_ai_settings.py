import httpx
import pytest
from app.core import config
from app.api.routes import ai, jds
from app.services import llm
from app.schemas.contracts import JDAnalysis


def test_env_edits_are_read_without_restart(tmp_path, monkeypatch):
    path = tmp_path / ".env"
    for name in ("LLM_PROVIDER", "GEMINI_MODEL", "GEMINI_API_KEY", "OLLAMA_MODEL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setitem(config.AISettings.model_config, "env_file", path)
    path.write_text("LLM_PROVIDER=gemini\nGEMINI_MODEL=example-first\nGEMINI_API_KEY=test-secret\n")
    assert llm.provider_for().model == "example-first"
    path.write_text("LLM_PROVIDER=gemini\nGEMINI_MODEL=example-second\nGEMINI_API_KEY=test-secret\n")
    assert llm.provider_for().model == "example-second"
    path.write_text("LLM_PROVIDER=ollama\nOLLAMA_MODEL=example-local\n")
    assert llm.provider_for().name == "ollama"
    assert llm.provider_for().model == "example-local"


def test_browser_selection_is_request_scoped_and_secrets_are_hidden(client, monkeypatch):
    settings = config.AISettings(_env_file=None, llm_provider="gemini", gemini_model="server-model", gemini_api_key="not-for-browser")
    monkeypatch.setattr(ai, "get_ai_settings", lambda: settings)
    chosen = client.get("/api/v1/ai/config", headers={"X-AI-Provider":"ollama","X-AI-Model":"local-model:latest"}).json()
    assert chosen["provider"] == "ollama" and chosen["model"] == "local-model:latest"
    assert "not-for-browser" not in str(chosen)
    defaults = client.get("/api/v1/ai/config").json()
    assert defaults["model"] == "server-model"


def test_model_header_rejects_urls_and_unknown_providers(client):
    assert client.get("/api/v1/ai/config", headers={"X-AI-Provider":"other"}).status_code == 422
    assert client.get("/api/v1/ai/config", headers={"X-AI-Provider":"gemini","X-AI-Model":"https://example.com"}).status_code == 422


def test_ollama_image_selection_does_not_silently_use_cloud(monkeypatch):
    monkeypatch.setattr(llm, "get_ai_settings", lambda: config.AISettings(_env_file=None, gemini_api_key="available"))
    with pytest.raises(RuntimeError, match="No automatic cloud fallback"):
        llm.provider_for("image", "ollama", "local-model")


def test_gemini_retries_busy_error_and_redacts_raw_response(monkeypatch):
    attempts = []
    class FakeClient:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, *args, **kwargs):
            attempts.append(1)
            return httpx.Response(503, json={"error":"private-provider-body"})
    monkeypatch.setattr(llm.httpx, "Client", FakeClient)
    monkeypatch.setattr(llm.time, "sleep", lambda _: None)
    provider = llm.GeminiProvider(config.AISettings(_env_file=None, gemini_api_key="test-secret"), "example-model")
    with pytest.raises(RuntimeError) as error:
        provider.generate_text("test")
    assert len(attempts) == 3
    assert "HTTP 503" in str(error.value)
    assert "test-secret" not in str(error.value) and "private-provider-body" not in str(error.value)


def test_model_list_filters_and_paginates(client, monkeypatch):
    monkeypatch.setattr(ai, "get_ai_settings", lambda: config.AISettings(_env_file=None, gemini_api_key="secret"))
    class FakeClient:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def get(self, url, **kwargs):
            if kwargs["params"].get("pageToken"):
                return httpx.Response(200, json={"models":[{"name":"models/second","supportedGenerationMethods":["generateContent"]}]})
            return httpx.Response(200, json={"models":[{"name":"models/first","supportedGenerationMethods":["generateContent"]},{"name":"models/embed","supportedGenerationMethods":["embedContent"]}],"nextPageToken":"next"})
    monkeypatch.setattr(ai.httpx, "Client", FakeClient)
    result = client.get("/api/v1/ai/models?provider=gemini")
    assert result.status_code == 200
    assert [m["id"] for m in result.json()["models"]] == ["first", "second"]


def test_test_button_uses_selected_structured_provider(client, monkeypatch):
    calls = []
    class Provider:
        name = "gemini"
        model = "chosen-model"
        def generate_structured(self, prompt, schema):
            calls.append(prompt)
            return schema(status="ok")
    def choose(task, provider, model):
        assert (task, provider, model) == ("text", "gemini", "chosen-model")
        return Provider()
    monkeypatch.setattr(ai, "provider_for", choose)
    result = client.post("/api/v1/ai/test", headers={"X-AI-Provider":"gemini","X-AI-Model":"chosen-model"})
    assert result.status_code == 200 and result.json()["model"] == "chosen-model"
    assert "No student data" in calls[0]


def test_role_analysis_uses_selected_provider(client, monkeypatch):
    role = client.post("/api/v1/job-descriptions", json={"name":"Example role","raw_text":"EXAMPLE: Build APIs with Python."}).json()
    class Provider:
        def analyze_jd(self, text):
            return JDAnalysis(required_skills=["Python"])
    def choose(task, provider, model):
        assert provider == "ollama" and model == "example-local"
        return Provider()
    monkeypatch.setattr(jds, "provider_for", choose)
    result = client.post(f"/api/v1/job-descriptions/{role['id']}/analyze",headers={"X-AI-Provider":"ollama","X-AI-Model":"example-local"})
    assert result.status_code == 200
