import { useState } from "react";
import { Pager } from "./UI";

export type ResumeEntry = {
  document_type: string; title: string; summary: string;
  organization: string | null; start_date: string | null; end_date: string | null;
  skills: string[]; mentioned_skills: string[]; accomplishments: string[]; uncertainties: string[];
  skill_evidence?: { skill: string; excerpt: string; attribution: string; support: string }[];
};
export function ResumeEntries({ entries, onChange, disabled }: { entries: ResumeEntry[]; onChange: (entries: ResumeEntry[]) => void; disabled: boolean }) {
  const [page, setPage] = useState(1);
  const current = Math.min(page, Math.max(1, Math.ceil(entries.length / 5)));
  const update = (index: number, value: Partial<ResumeEntry>) => onChange(entries.map((entry, i) => i === index ? { ...entry, ...value } : entry));
  return <section className="section-gap">
    <h2>Resume entries ({entries.length})</h2>
    <p>Review each item before confirming. Only these entries become career evidence; the resume itself is not an experience. Include skills only where the entry supports them.</p>
    {!entries.length && <p>Add an entry below, or reanalyze this resume to extract its sections.</p>}
    {entries.slice((current - 1) * 5, current * 5).map((entry, offset) => {
      const index = (current - 1) * 5 + offset;
      return <details className="resume-check" key={index}>
        <summary>{entry.title || "Untitled entry"} · {entry.document_type}</summary>
        <fieldset disabled={disabled} className="resume-entry-fields">
          <label>Entry title<input value={entry.title} maxLength={240} onChange={e => update(index, { title: e.target.value })} /></label>
          <label>Entry category<select value={entry.document_type} onChange={e => update(index, { document_type: e.target.value })}>
            {["education", "project", "internship", "certification", "workshop", "achievement", "other"].map(type => <option key={type}>{type}</option>)}
          </select></label>
          <label>What you did or studied<textarea value={entry.summary} maxLength={6000} onChange={e => update(index, { summary: e.target.value })} /></label>
          <label>Institution or organization<input value={entry.organization || ""} onChange={e => update(index, { organization: e.target.value || null })} /></label>
          <div className="form-grid">
            <label>Start date<input type="date" value={entry.start_date || ""} onChange={e => update(index, { start_date: e.target.value || null })} /></label>
            <label>End date<input type="date" value={entry.end_date || ""} onChange={e => update(index, { end_date: e.target.value || null })} /></label>
          </div>
          <label>Supported skills (one per line)<textarea value={entry.skills.join("\n")} onChange={e => update(index, { skills: e.target.value.split("\n") })} /></label>
          {!!entry.skill_evidence?.length && <details>
            <summary>Why these skills were extracted ({entry.skill_evidence.length})</summary>
            <ul>{entry.skill_evidence.map((item, evidenceIndex) => <li key={`${item.skill}-${evidenceIndex}`}><strong>{item.skill}:</strong> “{item.excerpt}”</li>)}</ul>
          </details>}
          <label>Accomplishments (one per line)<textarea value={entry.accomplishments.join("\n")} onChange={e => update(index, { accomplishments: e.target.value.split("\n") })} /></label>
          <label>Details to check (one per line)<textarea value={entry.uncertainties.join("\n")} onChange={e => update(index, { uncertainties: e.target.value.split("\n") })} /></label>
          <button className="secondary" type="button" onClick={() => onChange(entries.filter((_, i) => i !== index))}>Exclude this entry</button>
        </fieldset>
      </details>;
    })}
    <Pager page={current} total={entries.length} size={5} onChange={setPage} />
    <button className="secondary" type="button" disabled={disabled || entries.length >= 50} onClick={() => {
      onChange([...entries, { document_type: "project", title: "", summary: "", organization: null, start_date: null, end_date: null, skills: [], mentioned_skills: [], skill_evidence: [], accomplishments: [], uncertainties: [] }]);
      setPage(Math.ceil((entries.length + 1) / 5));
    }}>Add an entry</button>
  </section>;
}
