import { supabase } from "./supabase";
import { getAIPreference } from "./aiPreferences";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  const preference = data.session?.user.id
    ? getAIPreference(data.session.user.id)
    : null;
  if (preference) {
    if (!headers.has("X-AI-Provider"))
      headers.set("X-AI-Provider", preference.provider);
    if (preference.model && !headers.has("X-AI-Model"))
      headers.set("X-AI-Model", preference.model);
  }
  if (!(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (data.session?.access_token)
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new ApiError(
      response.status,
      typeof body.detail === "string"
        ? body.detail
        : JSON.stringify(body.detail),
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
