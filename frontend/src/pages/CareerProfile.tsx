import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { api } from "../lib/api";
import type { CareerRecord } from "../types";
import {
  Card,
  Dialog,
  Empty,
  ExpandText,
  Notice,
  PageHeader,
  Pager,
  SkillChips,
  Spinner,
  Status,
} from "../components/UI";

type Source = { record_id: string; title: string; document_id: string | null };
type Skill = { name: string; sources: Source[] };
type EvidenceProfile = {
  summary: string | null;
  skills: Skill[];
  records: unknown[];
  insights?: {
    strengths: { skill: string; source_count: number; contexts: string[]; confidence: string; basis: string }[];
    portfolio_health: { reviewed_entries: number; documented_skills: number; dated_entries: number; multi_source_skills: number; resume_claim_entries: number };
    limitations: { code: string; text: string; href: string }[];
    alignment: null | { role_id: string; role_name: string; score: number; supported: { skill: string }[]; gaps: { skill: string; evidence_expectation: string }[]; general_competencies: string[]; disclaimer: string };
    next_steps: { code: string; text: string; href: string }[];
  };
};
const tabs = ["overview", "skills", "experience", "education", "timeline"];
const types = [
  "project",
  "internship",
  "certification",
  "workshop",
  "achievement",
  "education",
  "other",
];
export function CareerProfile() {
  const [params, setParams] = useSearchParams();
  const tab = tabs.includes(params.get("tab") || "")
    ? params.get("tab")!
    : "overview";
  const [data, setData] = useState<EvidenceProfile>();
  const [records, setRecords] = useState<CareerRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [skill, setSkill] = useState<Skill>();
  const [sourcePage, setSourcePage] = useState(1);
  const [detail, setDetail] = useState<CareerRecord>();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleteEntry, setDeleteEntry] = useState<CareerRecord>();
  const [form, setForm] = useState({
    title: "",
    record_type: "project",
    organization: "",
    description: "",
    start_date: "",
    end_date: "",
    skills: "",
  });
  async function load() {
    try {
      setError("");
      const [e, r] = await Promise.all([
        api<EvidenceProfile>(`/profile/evidence${sessionStorage.getItem("career-target-role") ? `?role_id=${encodeURIComponent(sessionStorage.getItem("career-target-role")!)}` : ""}`),
        api<CareerRecord[]>("/records"),
      ]);
      setData(e);
      setRecords(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load profile");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    setPage(1);
    setQuery("");
    setFilter("all");
  }, [tab]);
  async function regenerate() {
    setBusy(true);
    setError("");
    try {
      await api("/profile/summary", { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate summary");
    } finally {
      setBusy(false);
    }
  }
  async function add() {
    setBusy(true);
    setError("");
    try {
      await api(editingId ? `/records/items/${editingId}` : "/records", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          organization: form.organization || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          skills: form.skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setAdding(false);
      setEditingId(undefined);
      setForm({
        title: "",
        record_type: "project",
        organization: "",
        description: "",
        start_date: "",
        end_date: "",
        skills: "",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save record");
    } finally {
      setBusy(false);
    }
  }
  const changeTab = (value: string) => setParams({ tab: value });
  const skills = (data?.skills || []).filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "multiple"
          ? s.sources.length > 1
          : s.sources.length === 1)),
  );
  const visible = records
    .filter(
      (r) =>
        (tab === "education"
          ? r.record_type === "education"
          : tab === "experience"
            ? r.record_type !== "education"
            : true) &&
        (filter === "all" || r.record_type === filter) &&
        `${r.title} ${r.organization || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
  const shown = visible.slice(
    (Math.min(page, Math.max(1, Math.ceil(visible.length / 8))) - 1) * 8,
    Math.min(page, Math.max(1, Math.ceil(visible.length / 8))) * 8,
  );
  const skillPage = Math.min(page, Math.max(1, Math.ceil(skills.length / 12)));
  return (
    <>
      <PageHeader
        eyebrow="Your evidence, connected"
        title="Career profile"
        description="Understand your strengths and keep the experience behind them organized."
        action={
          <Link className="secondary" to="/settings">
            Edit personal details
          </Link>
        }
      />
      <nav className="tabs" aria-label="Profile sections">
        {tabs.map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            className={tab === t ? "active" : ""}
            onClick={() => changeTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {error && (
        <Notice kind="error">
          {error}{" "}
          <button className="text-button" onClick={() => void load()}>
            Retry
          </button>
        </Notice>
      )}
      {!data ? (
        !error && <Spinner />
      ) : (
        <>
          {tab === "overview" && (
            <>
              <div className="metric-grid">
                <Card>
                  <span>Documented skills</span>
                  <strong>{data.skills.length}</strong>
                  <small>From confirmed information</small>
                </Card>
                <Card>
                  <span>Reviewed career entries</span>
                  <strong>{data.records.length}</strong>
                  <small>Reviewed by you, not externally verified</small>
                </Card>
                <Card>
                  <span>Personal entries</span>
                  <strong>
                    {
                      records.filter((r) => r.evidence_state === "claimed")
                        .length
                    }
                  </strong>
                  <small>Separate from document evidence</small>
                </Card>
              </div>
              <Card className="profile-narrative">
                <div className="card-head">
                  <div>
                    <p className="eyebrow">At a glance</p>
                    <h2>Your evidence-based story</h2>
                  </div>
                  <button
                    className="secondary"
                    disabled={busy || !data.records.length}
                    onClick={regenerate}
                  >
                    {busy ? "Writing..." : "Refresh summary"}
                  </button>
                </div>
                {data.summary ? (
                  <ExpandText text={data.summary} limit={1000} />
                ) : (
                  <p>
                    Confirm the analysis of a document to build an
                    evidence-backed summary.
                  </p>
                )}
                <small>
                  Based on reviewed sources. Resume claims are self-reported, not independently verified. Refresh summary for AI-written wording.
                </small>
              </Card>
              {data.insights && <div className="profile-intelligence section-gap">
                <Card>
                  <p className="eyebrow">What your evidence supports</p>
                  <h2>Strongest documented themes</h2>
                  {data.insights.strengths.length ? <div className="strength-list">{data.insights.strengths.slice(0, 6).map(item => <button key={item.skill} onClick={() => { const found = data.skills.find(s => s.name === item.skill); if (found) setSkill(found); }}>
                    <b>{item.skill}</b><span>{item.basis} · {item.confidence} · {item.contexts.join(", ")}</span>
                  </button>)}</div> : <p>Review a document to establish source-linked strengths.</p>}
                  <p className="helper">Themes describe available evidence, not an inferred proficiency level.</p>
                </Card>
                <Card>
                  <p className="eyebrow">Portfolio health</p>
                  <h2>Where the profile is reliable—and thin</h2>
                  <div className="health-grid">
                    <span><b>{data.insights.portfolio_health.dated_entries}</b> dated entries</span>
                    <span><b>{data.insights.portfolio_health.multi_source_skills}</b> skills with repeated evidence</span>
                    <span><b>{data.insights.portfolio_health.resume_claim_entries}</b> resume-claim entries</span>
                  </div>
                  {data.insights.limitations.map(item => <Link className="insight-row" key={item.code} to={item.href}>{item.text}<ArrowUpRight size={15} /></Link>)}
                  {!data.insights.limitations.length && <p>No structural gaps were flagged. Continue checking every claim against its source.</p>}
                </Card>
              </div>}
              {data.insights?.alignment && <Card className="section-gap target-connection">
                <div className="card-head"><div><p className="eyebrow">Connected target role</p><h2>{data.insights.alignment.role_name}</h2></div><Link className="secondary" to="/planning/roles">Open full role analysis</Link></div>
                <p><b>{data.insights.alignment.supported.length}</b> {data.insights.alignment.supported.length === 1 ? "requirement has" : "requirements have"} related reviewed evidence; <b>{data.insights.alignment.gaps.length}</b> still {data.insights.alignment.gaps.length === 1 ? "needs" : "need"} evidence. This is portfolio coverage, not hiring readiness.</p>
                <div className="two-column">
                  <div><h3>Supported</h3><SkillChips skills={data.insights.alignment.supported.map(item => item.skill)} limit={8} /></div>
                  <div><h3>Priority gaps</h3>{data.insights.alignment.gaps.slice(0, 4).map(item => <div className="insight-row" key={item.skill}><span><b>{item.skill}</b><small>{item.evidence_expectation}</small></span></div>)}</div>
                </div>
              </Card>}
              {!!data.insights?.next_steps.length && <Card className="section-gap"><p className="eyebrow">Recommended sequence</p><h2>Your next three useful moves</h2><ol className="connected-steps">{data.insights.next_steps.map((item, index) => <li key={item.code}><span>{index + 1}</span><Link to={item.href}>{item.text}<ArrowUpRight size={15} /></Link></li>)}</ol></Card>}
              <div className="two-column section-gap">
                <Card>
                  <div className="card-head">
                    <h2>Skills backed by your work</h2>
                    <button
                      className="text-button"
                      onClick={() => changeTab("skills")}
                    >
                      View all ({data.skills.length})
                    </button>
                  </div>
                  <div className="skill-grid compact">
                    {data.skills.slice(0, 8).map((s) => (
                      <button
                        className="skill-card"
                        key={s.name}
                        onClick={() => {
                          setSkill(s);
                          setSourcePage(1);
                        }}
                      >
                        <b>{s.name}</b>
                        <small>
                          {s.sources.length} supporting record
                          {s.sources.length === 1 ? "" : "s"}
                        </small>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                  {!data.skills.length && (
                    <p>
                      Reviewed skills will appear here. No proficiency scores
                      are inferred.
                    </p>
                  )}
                </Card>
                <Card>
                  <div className="card-head">
                    <h2>Recent experience</h2>
                    <button
                      className="text-button"
                      onClick={() => changeTab("experience")}
                    >
                      View experience
                    </button>
                  </div>
                  {records.slice(0, 3).map((r) => (
                    <button
                      className="record-link"
                      key={r.id}
                      onClick={() => setDetail(r)}
                    >
                      <span>
                        <b>{r.title}</b>
                        <small>
                          {r.record_type} ·{" "}
                          {r.start_date || "Date not provided"}
                        </small>
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                  {!records.length && (
                    <Empty
                      title="Start with your work"
                      description="Upload a certificate, project or internship document."
                      action={
                        <Link className="primary" to="/documents">
                          Add document
                        </Link>
                      }
                    />
                  )}
                </Card>
              </div>
            </>
          )}
          {tab === "skills" && (
            <>
              <div className="toolbar">
                <div className="search">
                  <Search />
                  <input
                    aria-label="Search skills"
                    placeholder="Search your skills"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <select
                  aria-label="Filter skill evidence"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All evidence</option>
                  <option value="multiple">Multiple supporting records</option>
                  <option value="single">One supporting record</option>
                </select>
              </div>
              <p className="helper">
                Select a skill to see its sources. Supporting records are
                evidence, not a proficiency rating.
              </p>
              {skills.length ? (
                <>
                  <div className="skill-grid">
                    {skills
                      .slice((skillPage - 1) * 12, skillPage * 12)
                      .map((s) => (
                        <button
                          className="skill-card"
                          key={s.name}
                          onClick={() => {
                            setSkill(s);
                            setSourcePage(1);
                          }}
                        >
                          <b>{s.name}</b>
                          <small>
                            {s.sources.length} supporting record
                            {s.sources.length === 1 ? "" : "s"}
                          </small>
                          <span className="status status-completed">
                            Confirmed by you
                          </span>
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                  </div>
                  <Pager
                    page={skillPage}
                    total={skills.length}
                    size={12}
                    onChange={setPage}
                  />
                </>
              ) : (
                <Empty
                  title="No matching skills"
                  description="Try a different search, or confirm demonstrated skills from a document."
                />
              )}
            </>
          )}
          {["experience", "education", "timeline"].includes(tab) && (
            <>
              <div className="toolbar">
                <div className="search">
                  <Search />
                  <input
                    aria-label="Search experience"
                    placeholder="Search title or organization"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                {tab !== "education" && (
                  <select
                    aria-label="Experience category"
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">All categories</option>
                    {types.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                )}
                <button
                  className="primary"
                  onClick={() => {
                    setEditingId(undefined);
                    setForm({
                      title: "",
                      record_type:
                        tab === "education" ? "education" : "project",
                      organization: "",
                      description: "",
                      start_date: "",
                      end_date: "",
                      skills: "",
                    });
                    setAdding(true);
                  }}
                >
                  <Plus size={16} />
                  Add experience
                </button>
              </div>
              {shown.length ? (
                <>
                  <div
                    className={tab === "timeline" ? "timeline" : "record-grid"}
                  >
                    {shown.map((r) => (
                      <Card key={r.id}>
                        {tab === "timeline" && (
                          <p className="eyebrow">
                            {r.start_date?.slice(0, 4) || "Needs dates"}
                          </p>
                        )}
                        <div className="card-head">
                          <span className="record-type">{r.record_type}</span>
                          <Status
                            value={
                              r.evidence_state === "claimed"
                                ? "Personal entry"
                                : "Confirmed by you"
                            }
                          />
                        </div>
                        <h2>{r.title}</h2>
                        <p>{r.organization || "Organization not provided"}</p>
                        <small>
                          {r.start_date || "Date not provided"}
                          {r.end_date && ` – ${r.end_date}`}
                        </small>
                        <p className="clamp">
                          {r.description || "No description added."}
                        </p>
                        <SkillChips skills={r.skills} />
                        <button
                          className="text-button section-gap"
                          onClick={() => setDetail(r)}
                        >
                          View details & source <ArrowUpRight size={15} />
                        </button>
                      </Card>
                    ))}
                  </div>
                  <Pager
                    page={page}
                    total={visible.length}
                    size={8}
                    onChange={setPage}
                  />
                </>
              ) : (
                <Empty
                  title="No matching experience"
                  description="Confirm an uploaded document or add a personal entry. Personal entries remain separate from confirmed evidence."
                />
              )}
            </>
          )}
        </>
      )}
      {skill && (
        <Dialog title={skill.name} onClose={() => setSkill(undefined)}>
          <p>
            Confirmed by you from the following records. This is not an external
            verification.
          </p>
          {skill.sources
            .slice((sourcePage - 1) * 6, sourcePage * 6)
            .map((s) => (
              <div className="source-row" key={s.record_id}>
                <b>{s.title}</b>
                {s.document_id ? (
                  <Link
                    className="secondary"
                    to={`/documents/${s.document_id}`}
                  >
                    Open source <ArrowUpRight size={15} />
                  </Link>
                ) : (
                  <span>Source file not available</span>
                )}
              </div>
            ))}
          <Pager
            page={sourcePage}
            total={skill.sources.length}
            size={6}
            onChange={setSourcePage}
          />
        </Dialog>
      )}
      {detail && (
        <Dialog title={detail.title} onClose={() => setDetail(undefined)}>
          <Status
            value={
              detail.evidence_state === "claimed"
                ? "Personal entry"
                : "Confirmed by you"
            }
          />
          <p>
            {detail.organization} · {detail.start_date || "Date not provided"}
          </p>
          <ExpandText text={detail.description} />
          <details>
            <summary>All skills ({detail.skills.length})</summary>
            <SkillChips skills={detail.skills} limit={detail.skills.length} />
          </details>
          {detail.source_document_id ? (
            <div className="button-row">
            <Link
              className="primary section-gap"
              to={`/documents/${detail.source_document_id}`}
            >
              Review source & edit details
            </Link>
            <button className="secondary danger" onClick={() => { setDeleteEntry(detail); setDetail(undefined); }}>Delete entry</button>
            </div>
          ) : (
            <>
              <p className="helper">
                This is a personal entry, not confirmed document evidence.
              </p>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => {
                    setEditingId(detail.id);
                    setForm({
                      title: detail.title,
                      record_type: detail.record_type,
                      organization: detail.organization || "",
                      description: detail.description || "",
                      start_date: detail.start_date || "",
                      end_date: detail.end_date || "",
                      skills: detail.skills.join(", "),
                    });
                    setDetail(undefined);
                    setAdding(true);
                  }}
                >
                  Edit entry
                </button>
                <button
                  className="secondary danger"
                  onClick={() => {
                    setDeleteEntry(detail);
                    setDetail(undefined);
                  }}
                >
                  Delete entry
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
      {deleteEntry && (
        <Dialog
          title="Delete personal entry?"
          onClose={() => {
            if (!busy) setDeleteEntry(undefined);
          }}
        >
          <p>This removes “{deleteEntry.title}”. It cannot be undone.</p>
          {deleteEntry.source_document_id && <p>The original document and saved resume snapshots are kept. Confirming this document again can restore the extracted entry; exclude it in the document review if you want it omitted from future confirmations.</p>}
          {error && <Notice kind="error">{error}</Notice>}
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleteEntry(undefined)}
            >
              Cancel
            </button>
            <button
              className="primary danger-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api(`/records/items/${deleteEntry.id}`, {
                    method: "DELETE",
                  });
                  setDeleteEntry(undefined);
                  await load();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not delete entry",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete entry
            </button>
          </div>
        </Dialog>
      )}
      {adding && (
        <Dialog
          title={
            editingId ? "Edit personal experience" : "Add personal experience"
          }
          onClose={() => {
            if (!busy) setAdding(false);
          }}
        >
          <p>
            This entry is labelled as a personal claim. Upload supporting
            evidence to include it in your confirmed profile.
          </p>
          {error && <Notice kind="error">{error}</Notice>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <label>
              Title
              <input
                required
                maxLength={240}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Category
                <select
                  value={form.record_type}
                  onChange={(e) =>
                    setForm({ ...form, record_type: e.target.value })
                  }
                >
                  {types.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Organization
                <input
                  value={form.organization}
                  onChange={(e) =>
                    setForm({ ...form, organization: e.target.value })
                  }
                />
              </label>
              <label>
                Start date
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={form.end_date}
                  min={form.start_date || undefined}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label>
              Skills, separated by commas
              <input
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
              />
            </label>
            <div className="button-row">
              <button
                className="secondary"
                type="button"
                disabled={busy}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Saving..." : "Save personal entry"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
