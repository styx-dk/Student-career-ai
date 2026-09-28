import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api } from "../lib/api";
import type { JD, Match } from "../types";
import {
  Card,
  Dialog,
  Empty,
  Notice,
  Pager,
  Spinner,
  Status,
} from "../components/UI";
export function Jobs() {
  const [jds, setJds] = useState<JD[]>();
  const [selected, setSelected] = useState<JD>();
  const [match, setMatch] = useState<Match>();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pick = (jd: JD) => {
    setSelected(jd);
    setMatch(undefined);
    setQuery("");
    setPage(1);
    sessionStorage.setItem("career-target-role", jd.id);
  };
  async function load() {
    setError("");
    try {
      const r = await api<JD[]>("/job-descriptions");
      setJds(r);
      const saved =
        r.find((j) => j.id === sessionStorage.getItem("career-target-role")) ||
        r[0];
      if (saved) pick(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load roles");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function task(label: string, fn: () => Promise<void>) {
    setError("");
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy("");
    }
  }
  const requirements = (
    match?.requirements ||
    selected?.requirements ||
    []
  ).filter((r) => r.skill.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      {error && (
        <Notice kind="error">
          {error}{" "}
          {!jds && (
            <button className="text-button" onClick={() => void load()}>
              Retry
            </button>
          )}
        </Notice>
      )}
      {busy && <Notice>{busy}</Notice>}
      {!jds ? (
        !error && <Spinner />
      ) : (
        <>
          <div className="toolbar">
            <label className="role-selector">
              Your target role
              <select
                aria-label="Choose saved role"
                value={selected?.id || ""}
                disabled={!!busy}
                onChange={(e) => {
                  const j = jds.find((x) => x.id === e.target.value);
                  if (j) pick(j);
                }}
              >
                {!jds.length && <option value="">No saved roles</option>}
                {jds.map((j) => (
                  <option value={j.id} key={j.id}>
                    {j.job_title || j.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={!!busy}
              onClick={() => setAdding(true)}
            >
              <Plus size={16} />
              Add target role
            </button>
          </div>
          {!selected ? (
            <Empty
              title="What role would you like to explore?"
              description="Add a job description to identify its requirements and compare them with your profile."
              action={
                <button className="primary" onClick={() => setAdding(true)}>
                  Add your first role
                </button>
              }
            />
          ) : (
            <>
              <Card>
                <div className="card-head">
                  <div>
                    <p className="eyebrow">Current target</p>
                    <h2>{selected.job_title || selected.name}</h2>
                    <p>
                      {selected.company ||
                        selected.domain ||
                        "Analyze this description to identify its requirements."}
                    </p>
                  </div>
                  <Link className="secondary" to="/planning/actions">
                    Build an action plan
                  </Link>
                </div>
                <details>
                  <summary>Read job description</summary>
                  <p className="prose">{selected.raw_text}</p>
                </details>
                <div className="button-row">
                  <button
                    className="secondary"
                    disabled={!!busy}
                    onClick={() =>
                      void task("Analyzing role requirements...", async () => {
                        const j = await api<JD>(
                          `/job-descriptions/${selected.id}/analyze`,
                          { method: "POST" },
                        );
                        pick(j);
                        setJds(jds.map((x) => (x.id === j.id ? j : x)));
                      })
                    }
                  >
                    {selected.requirements.length
                      ? "Refresh requirements"
                      : "Find required skills"}
                  </button>
                  <button
                    className="primary"
                    disabled={!!busy || !selected.requirements.length}
                    onClick={() =>
                      void task("Comparing your profile...", async () => {
                        setMatch(
                          await api<Match>(
                            `/job-descriptions/${selected.id}/match`,
                          ),
                        );
                        setPage(1);
                      })
                    }
                  >
                    Compare with my profile
                  </button>
                </div>
              </Card>
              {match && (
                <>
                  <div className="score-grid section-gap">
                    <Card>
                      <p>Estimated readiness</p>
                      <strong>{match.score}%</strong>
                    </Card>
                    <Card>
                      <p>Skill coverage</p>
                      <strong>{match.skill_coverage}%</strong>
                    </Card>
                    <Card>
                      <p>Evidence coverage</p>
                      <strong>{match.evidence_coverage}%</strong>
                    </Card>
                  </div>
                  <Notice>{match.disclaimer}</Notice>
                </>
              )}
              <Card className="section-gap">
                <div className="card-head">
                  <h2>
                    {match
                      ? "Your strengths & skill gaps"
                      : "Role requirements"}
                  </h2>
                  <span className="helper">{requirements.length} skills</span>
                </div>
                <div className="search">
                  <Search />
                  <input
                    aria-label="Search role requirements"
                    placeholder="Find a skill"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                {requirements.length ? (
                  <>
                    <div className="match-list">
                      {requirements
                        .slice((page - 1) * 12, page * 12)
                        .map((r) => (
                          <div key={r.skill}>
                            <div>
                              <b>{r.skill}</b>
                              {"evidence" in r && (
                                <span>
                                  {r.evidence
                                    .slice(0, 2)
                                    .map((e) => e.title)
                                    .join(", ") || "No matching experience yet"}
                                  {r.evidence.length > 2 &&
                                    ` +${r.evidence.length - 2} more`}
                                </span>
                              )}
                            </div>
                            <Status
                              value={
                                "classification" in r
                                  ? r.classification
                                  : r.importance
                              }
                            />
                          </div>
                        ))}
                    </div>
                    <Pager
                      page={page}
                      total={requirements.length}
                      size={12}
                      onChange={setPage}
                    />
                  </>
                ) : (
                  <p className="helper section-gap">
                    {query
                      ? "No matching requirements."
                      : "Analyze the job description to see its required skills."}
                  </p>
                )}
              </Card>
            </>
          )}
        </>
      )}
      {adding && (
        <Dialog
          title="Add a target role"
          onClose={() => {
            if (!busy) setAdding(false);
          }}
        >
          {error && <Notice kind="error">{error}</Notice>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task("Saving role...", async () => {
                const j = await api<JD>("/job-descriptions", {
                  method: "POST",
                  body: JSON.stringify({ name, raw_text: text }),
                });
                setJds([j, ...(jds || [])]);
                pick(j);
                setAdding(false);
                setName("");
                setText("");
              });
            }}
          >
            <label>
              Role name
              <input
                required
                maxLength={240}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Junior Data Analyst"
              />
            </label>
            <label>
              Job description
              <textarea
                required
                minLength={20}
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the actual responsibilities and requirements."
              />
            </label>
            <p className="helper">
              This text is sent to your configured AI provider when you analyze
              it.
            </p>
            <div className="button-row">
              <button
                type="button"
                className="secondary"
                disabled={!!busy}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button className="primary" disabled={!!busy || !name.trim()}>
                {busy ? "Saving..." : "Save role"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
