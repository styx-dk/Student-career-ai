import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Profile } from "../types";
import { Card, Notice, PageHeader, Spinner, Status } from "../components/UI";
import { AISettings } from "../components/AISettings";
type Diagnostics = Record<string, string>;
export function Settings() {
  const [profile, setProfile] = useState<Profile>();
  const [diag, setDiag] = useState<Diagnostics>();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [diagError, setDiagError] = useState("");
  const [busy, setBusy] = useState(false);
  async function diagnostics() {
    setDiagError("");
    try {
      setDiag(await api("/diagnostics"));
    } catch (e) {
      setDiagError(
        e instanceof Error ? e.message : "Connection check unavailable",
      );
    }
  }
  async function load() {
    setError("");
    try {
      setProfile(await api("/profile"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load settings");
    }
  }
  useEffect(() => {
    void load();
    void diagnostics();
  }, []);
  async function save() {
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      setProfile(
        await api("/profile", { method: "PUT", body: JSON.stringify(profile) }),
      );
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Personal details & connections"
        description="Keep your contact information current and check the services supporting your workspace."
      />
      {error && (
        <Notice kind="error">
          {error}{" "}
          {!profile && (
            <button className="text-button" onClick={() => void load()}>
              Retry
            </button>
          )}
        </Notice>
      )}
      {saved && <Notice kind="success">Personal details saved.</Notice>}
      {!profile ? (
        !error && <Spinner />
      ) : (
        <div className="settings-grid">
          <Card>
            <h2>About you</h2>
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label>
                Full name
                <input
                  required
                  value={profile.full_name || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, full_name: e.target.value })
                  }
                />
              </label>
              <label>
                Headline
                <input
                  value={profile.headline || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, headline: e.target.value })
                  }
                  placeholder="e.g. Computer science student"
                />
              </label>
              <label>
                Phone
                <input
                  type="tel"
                  value={profile.phone || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                />
              </label>
              <label>
                Location
                <input
                  value={profile.location || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, location: e.target.value })
                  }
                />
              </label>
              <label className="full">
                Target role
                <input
                  value={profile.target_role || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, target_role: e.target.value })
                  }
                />
              </label>
              <button className="primary full" disabled={busy}>
                {busy ? "Saving..." : "Save details"}
              </button>
            </form>
          </Card>
          <Card>
            <div className="card-head">
              <h2>Connection status</h2>
              <button
                className="text-button"
                onClick={() => void diagnostics()}
              >
                Refresh
              </button>
            </div>
            <p className="helper">
              These are server defaults. Your active browser selection and model
              test are shown below.
            </p>
            {diagError ? (
              <Notice kind="error">{diagError}</Notice>
            ) : diag ? (
              <div className="diagnostics">
                {Object.entries(diag).map(([key, value]) => (
                  <div key={key}>
                    <span>{key.replaceAll("_", " ")}</span>
                    <Status value={String(value)} />
                  </div>
                ))}
              </div>
            ) : (
              <Spinner />
            )}
          </Card>
        </div>
      )}
      <AISettings />
    </>
  );
}
