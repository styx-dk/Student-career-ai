# AI Providers

`LLMProvider` defines text generation, structured generation, text/image document analysis, JD analysis, profile summaries and resume content. `OllamaProvider` uses Qwen 2.5 3B for text and requests JSON-schema output. `GeminiProvider` uses the configured REST model for structured text and multimodal image extraction.

Routing rules:

- text documents, JD analysis and wording: configured provider; Ollama by default
- images/scanned PDFs: require an explicitly selected Gemini provider; choosing Ollama shows a recoverable error instead of silently sending content to the cloud
- no image is sent to the text-only Qwen configuration

All database-bound output is Pydantic validated. The shared system constraint requires missing fields to remain `null` or `[]`. Provider failure never removes the original evidence.

## Switch without editing code

1. Open Account & preferences → Provider & model.
2. Select Gemini or Ollama.
3. Click **Load available models**, then choose an exact Model ID from the input suggestions (or type one).
4. Click **Save AI selection** and then **Test active model**.
5. Retry the document/role analysis.

The preference is stored per signed-in user in this browser, not globally. It applies to document analysis, job descriptions and AI profile wording. It survives page reloads but does not synchronize to other devices. Keys and server URLs are never stored in browser preferences. Testing sends a small synthetic structured-output prompt and may use API quota.

Select **Use server defaults (.env)** and save to remove the browser override.

## Environment-based configuration

The project-root .env is resolved relative to the backend code, not the terminal directory. AI settings are reread for each operation, including key rotation. Existing requests finish with their original configuration; new requests use the updated values.

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-server-side-key
GEMINI_MODEL=exact-model-id-from-the-model-list
```

For local text generation:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
```

Install/start Ollama on the backend machine and run `ollama pull qwen2.5:3b` before choosing it. The model must support structured output.

After installing this code update, restart the backend once. Future AI-only .env edits do not require a restart. Database/auth/CORS settings still require restart. Process-level environment variables take precedence over .env; clear any stale shell variables if they override your file. The old LLM_FALLBACK_PROVIDER value does not trigger automatic fallback.

## Model errors

- 404: unavailable/incorrect model ID; refresh the model list.
- 429: quota/rate limit; check project usage and billing.
- 503 and other temporary 5xx responses: provider outage/overload; Gemini retries at most twice, then gives a clear error. Choose another model if needed.
- Structured-output rejection: use the model test, not just the fact that a model appears in the list.

The model list is fetched from the configured provider, not maintained as a hardcoded list of model versions. Model listing and tests require authentication. Google reference: https://ai.google.dev/gemini-api/docs/troubleshooting
