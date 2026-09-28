export type AIPreference = { provider: "gemini" | "ollama"; model: string };
const key = (userId: string) => "career-compass:ai:" + userId;
export function getAIPreference(userId: string): AIPreference | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(userId)) || "null");
    return value &&
      ["gemini", "ollama"].includes(value.provider) &&
      typeof value.model === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveAIPreference(userId: string, value: AIPreference | null) {
  if (value) localStorage.setItem(key(userId), JSON.stringify(value));
  else localStorage.removeItem(key(userId));
}
