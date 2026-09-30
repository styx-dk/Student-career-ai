import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { getAIPreference, saveAIPreference } from "../lib/aiPreferences";
import { Card, Notice, Spinner } from "./UI";

type Configuration = {
  provider: "gemini" | "ollama";
  model: string;
  source: string;
  default_provider: "gemini" | "ollama";
  gemini_model: string;
  ollama_model: string;
  gemini_configured: boolean;
  image_support: boolean;
};
export function AISettings() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [config, setConfig] = useState<Configuration>();
  const [provider, setProvider] = useState("default");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [changed, setChanged] = useState(false);
  async function refresh() {
    const next = await api<Configuration>("/ai/config");
    setConfig(next);
    const preference = userId ? getAIPreference(userId) : null;
    setProvider(preference?.provider || "default");
    setModel(preference?.model || "");
    setChanged(false);
  }
  async function task(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI settings unavailable");
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    if (userId) void task("Loading AI settings...", refresh);
  }, [userId]);
  const effectiveProvider =
    provider === "default" ? config?.default_provider : provider;
  return (
    <Card className="section-gap">
      <div className="card-head">
        <div>
          <p className="eyebrow">AI configuration</p>
          <h2>Provider & model</h2>
        </div>
        <button
          className="secondary"
          disabled={!!busy}
          onClick={() => void task("Refreshing configuration...", refresh)}
        >
          Refresh from server
        </button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}
      {busy && <Notice>{busy}</Notice>}
      {config ? (
        <>
          <Notice>
            Active:{" "}
            <b>
              {config.provider} / {config.model || "No model selected"}
            </b>{" "}
            · {config.source}
          </Notice>
          <p>
            Choose a model for your account in this browser, or follow the
            server’s .env defaults. API keys stay on the server. Changing this
            does not affect other students.
          </p>
          <div className="form-grid">
            <label>
              AI provider
              <select
                aria-label="AI provider"
                value={provider}
                disabled={!!busy}
                onChange={(e) => {
                  const value = e.target.value;
                  setProvider(value);
                  setModel(
                    value === "gemini"
                      ? config.gemini_model
                      : value === "ollama"
                        ? config.ollama_model
                        : "",
                  );
                  setModels([]);
                  setChanged(true);
                  setMessage("");
                }}
              >
                <option value="default">Use server defaults (.env)</option>
                <option value="gemini">Gemini — cloud API</option>
                <option value="ollama">Ollama — local server</option>
              </select>
            </label>
            {provider !== "default" && (
              <label>
                Model ID
                <input
                  aria-label="Model ID"
                  list="available-ai-models"
                  maxLength={160}
                  value={model}
                  disabled={!!busy}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setChanged(true);
                    setMessage("");
                  }}
                  placeholder="Load available models or enter an exact ID"
                />
                <datalist id="available-ai-models">
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </datalist>
              </label>
            )}
          </div>
          {provider !== "default" && models.length > 0 && <label>Available models
            <select aria-label="Available models" value={models.some(item=>item.id===model)?model:""} disabled={!!busy} onChange={e=>{if(e.target.value){setModel(e.target.value);setChanged(true);setMessage("");}}}>
              <option value="">Choose an available model</option>
              {models.map(item=><option key={item.id} value={item.id}>{item.label} — {item.id}</option>)}
            </select>
          </label>}
          {provider === "default" && (
            <p className="helper">
              Default: {config.default_provider} /{" "}
              {config.default_provider === "gemini"
                ? config.gemini_model
                : config.ollama_model}
              . AI settings are reread from the root .env for each new request.
              Refresh this panel after editing.
            </p>
          )}
          {effectiveProvider === "gemini" && !config.gemini_configured && (
            <Notice kind="error">
              GEMINI_API_KEY is missing from the server .env.
            </Notice>
          )}
          {effectiveProvider === "ollama" && (
            <Notice>
              Ollama must be running on the backend machine and the model must
              be installed. Images and scanned PDFs are not supported through
              Ollama here; they will not silently be sent to Gemini. For complex
              resumes and long documents, a capable 7B/8B-or-larger instruct
              model usually gives more complete extraction than a 3B model,
              if your computer has enough memory.
            </Notice>
          )}
          <div className="button-row">
            {provider !== "default" && (
              <button
                className="secondary"
                disabled={!!busy}
                onClick={() =>
                  void task("Loading available models...", async () => {
                    const response = await api<{
                      models: { id: string; label: string }[];
                    }>(`/ai/models?provider=${provider}`);
                    setModels(response.models);
                    setMessage(
                      response.models.length
                        ? `${response.models.length} models loaded. Choose from Available models. Availability does not guarantee quota or structured-output support; test your selection.`
                        : "No models found. For Ollama, install a model with ollama pull first.",
                    );
                  })
                }
              >
                Load available models
              </button>
            )}
            <button
              className="secondary"
              disabled={!!busy || changed}
              onClick={() =>
                void task("Testing active model...", async () => {
                  const response = await api<{
                    provider: string;
                    model: string;
                    message: string;
                  }>("/ai/test", { method: "POST" });
                  setMessage(
                    `${response.provider} / ${response.model}: ${response.message}`,
                  );
                })
              }
            >
              Test active model
            </button>
            <button
              className="primary"
              disabled={
                !!busy || !userId || (provider !== "default" && !model.trim())
              }
              onClick={() =>
                void task("Saving selection...", async () => {
                  saveAIPreference(
                    userId!,
                    provider === "default"
                      ? null
                      : {
                          provider: provider as "gemini" | "ollama",
                          model: model.trim().replace(/^models\//, ""),
                        },
                  );
                  await refresh();
                  setMessage(
                    "Saved. New analysis requests use this selection immediately. Existing summaries are unchanged.",
                  );
                })
              }
            >
              Save AI selection
            </button>
          </div>
          <p className="helper section-gap">
            The test sends a tiny synthetic prompt, not student documents, and
            may use API quota. Save changes before testing. No automatic
            fallback to another provider is enabled.
          </p>
        </>
      ) : (
        !error && <Spinner />
      )}
    </Card>
  );
}
