# AI Providers

`LLMProvider` defines text generation, structured generation, text/image document analysis, JD analysis, profile summaries and resume content. `OllamaProvider` uses Qwen 2.5 3B for text and requests JSON-schema output. `GeminiProvider` uses the configured REST model for structured text and multimodal image extraction.

Routing rules:

- text documents, JD analysis and wording: configured provider; Ollama by default
- images: Gemini when configured; otherwise a visible, recoverable error
- no image is sent to the text-only Qwen configuration

All database-bound output is Pydantic validated. The shared system constraint requires missing fields to remain `null` or `[]`. Provider failure never removes the original evidence.

