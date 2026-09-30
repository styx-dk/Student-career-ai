import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Compass, Layers, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { Card, Notice, Pager } from "./UI";

type Requirement = { skill: string; importance: string; category: string; classification: string; similarity: number; evidence_expectation: string; source_excerpt?: string | null; market_contexts: string[]; sources: { title: string; document_id: string | null; record_id: string; basis: string }[] };
type Cockpit = {
  roles: { id: string; name: string }[]; selected_role: string | null;
  requirements: Requirement[]; supported: number; total: number;
  journey: { label: string; count: number; detail: string; href: string }[];
  resumes: { id: string; name: string; changed_sources: number; new_records: number; profile_changed: boolean; needs_review: boolean }[];
  general_competencies: string[];
};

export function CareerCockpit() {
  const [data, setData] = useState<Cockpit>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Requirement>();
  async function load(role?: string) {
    setLoading(true); setError("");
    try {
      const result = await api<Cockpit>(`/profile/cockpit${role ? `?role_id=${encodeURIComponent(role)}` : ""}`);
      setData(result); setPage(1); setSelected(undefined);
      if (result.selected_role) sessionStorage.setItem("career-target-role", result.selected_role);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect your workspace"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(sessionStorage.getItem("career-target-role") || undefined); }, []);
  const rows = (data?.requirements || []).filter(r => filter === "all" || (filter === "gaps" ? !r.sources.length : !!r.sources.length));
  return <section className="career-cockpit section-gap" aria-label="Career cockpit">
    <div className="cockpit-heading"><div><p className="eyebrow"><Compass size={16} /> Your connected workspace</p><h2>Career cockpit</h2><p>See how your work connects to your next opportunity.</p></div><button className="secondary" disabled={loading} onClick={() => void load(data?.selected_role || undefined)}>Refresh connections</button></div>
    {error && <Notice kind="error">{error} <button className="text-button" onClick={() => void load()}>Reset role & retry</button></Notice>}
    {loading && <p role="status">Connecting your evidence…</p>}
    {data && <>
      <nav className="journey-path" aria-label="Your career journey">{data.journey.map((step, i) => <Link to={step.href} key={step.label}>
        <span className="journey-number">0{i + 1}</span><strong>{step.label}<ArrowUpRight size={16} /></strong><span><b>{step.count}</b> {step.detail}</span>
      </Link>)}</nav>
      <div className="cockpit-grid">
        <Card>
          <div className="card-head"><h2>Role → skills → evidence</h2><Layers size={20} /></div>
          {data.roles.length ? <label>Focus role<select value={data.selected_role || ""} disabled={loading} onChange={e => void load(e.target.value)}>{data.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label> : <p><Link to="/planning/roles">Add a target role</Link> to map its requirements to your documents.</p>}
          {data.total > 0 ? <>
            <div className="coverage-heading"><strong>{data.supported}<small> / {data.total}</small></strong><span>requirements with reviewed evidence<br /><small>Evidence coverage—not a hiring probability.</small></span></div>
            <progress className="coverage-bar" max={data.total} value={data.supported} aria-label="Requirements with reviewed evidence" />
            <div className="cockpit-filters" aria-label="Filter requirements">{[["all", "All"], ["gaps", "Needs evidence"], ["supported", "Supported"]].map(([value, label]) => <button key={value} className={filter === value ? "primary" : "secondary"} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>{label}</button>)}</div>
            <div className="evidence-grid">{rows.slice((page - 1) * 8, page * 8).map(r => <button className={`evidence-node ${r.sources.length ? "supported" : "gap"}`} key={r.skill} aria-pressed={selected?.skill === r.skill} onClick={() => setSelected(r)}>
              <b>{r.skill}</b><span>{r.sources.length ? `${r.sources.length} source${r.sources.length === 1 ? "" : "s"}` : "Build evidence"} →</span>
            </button>)}</div>
            <Pager page={page} total={rows.length} size={8} onChange={setPage} />
          </> : data.roles.length > 0 && <p>No analyzed requirements yet. <Link to="/planning/roles">Find required skills</Link> for this role first.</p>}
        </Card>
        <Card className="mission-card">
          <p className="eyebrow"><Sparkles size={16} /> Evidence explorer</p>
          {selected ? <>
            <h2>{selected.skill}</h2>
            <p><span className="model-chip">{selected.category.replaceAll("_", " ")}</span> · {selected.importance}</p>
            <h3>What useful evidence looks like</h3><p>{selected.evidence_expectation}</p>
            {selected.source_excerpt && <blockquote>From the role: “{selected.source_excerpt}”</blockquote>}
            {!!selected.market_contexts.length && <Link className="secondary" to={`/planning/trends?domain=${encodeURIComponent(selected.market_contexts[0])}&skill=${encodeURIComponent(selected.skill)}`}>View historical market context →</Link>}
            {selected.sources.length ? <><p>These reviewed entries support this requirement. Review the original before making a claim.</p>{selected.sources.slice(0, 5).map(s => <Link className="record-link" key={s.record_id} to={s.document_id ? `/documents/${s.document_id}` : "/profile?tab=experience"}><span><b>{s.title}</b><small>{s.basis}</small></span><ArrowUpRight size={17} /></Link>)}{selected.sources.length > 5 && <Link to="/profile?tab=skills">Explore all sources in your profile →</Link>}</> : <>
              <p>No reviewed evidence yet. That does not mean you lack this skill.</p>
              <h3>Your suggested mini-project</h3><p>Create a small example using <b>{selected.skill}</b> for your target role. Choose a problem you can explain and a result you can demonstrate.</p>
              <ol className="mission-steps"><li>Define one outcome and a realistic scope.</li><li>Build or complete the exercise; save your work.</li><li>Write what you did, what worked and what you learned.</li><li>Upload the report and review its extracted evidence.</li></ol>
              <Link className="primary" to="/documents">Add proof of your work <ArrowUpRight size={16} /></Link>
              <p className="helper">A suggested exercise, not completed experience. Uploading alone does not establish proficiency.</p>
            </>}
          </> : <><h2>Follow the evidence.</h2><p>Select a skill to see its source documents or a practical way to build evidence for it.</p><div className="connection-illustration" aria-hidden="true"><span>Document</span><span>↓</span><span>Your skills</span><span>↓</span><span>Target role</span></div><Link to="/planning/actions">Open your action plan →</Link></>}
        </Card>
      </div>
      {!!data.general_competencies.length && <Card className="section-gap"><p className="eyebrow">Other employer expectations</p><h2>Clarify broad requirements; prepare examples for behaviors</h2><p>{data.general_competencies.join(" · ")}</p><p className="helper">These phrases are important but too broad to score like named technologies. Reanalyze the role for concrete tools; prepare a short situation-action-result example for behavioral expectations.</p></Card>}
      {!!data.resumes.length && <Card className="section-gap"><div className="card-head"><h2>Resume freshness</h2><Link to="/resumes">Open resume studio →</Link></div><p>Saved resumes are snapshots. New evidence does not silently rewrite a resume you already created.</p>{data.resumes.map(r => <div className="freshness-row" key={r.id}><div><b>{r.name}</b><p>{r.needs_review ? `${r.changed_sources} changed or removed sources · ${r.new_records} new entries${r.profile_changed ? " · profile details changed" : ""}` : "No source changes detected since creation."}</p></div><Link className="secondary" to={`/resumes?preview=${encodeURIComponent(r.id)}`}>{r.needs_review ? "Review & create a new snapshot" : "Preview resume"}</Link></div>)}</Card>}
    </>}
  </section>;
}
