import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Card, Notice } from "./UI";

type Progress = {
  days: { date: string; completed: boolean }[];
  active_days: number;
  reviewed_today: boolean;
  quests: { title: string; detail: string; href: string }[];
  resumes: { id: string; name: string; confirmed: boolean; issues: string[] }[];
};

export function StudentProgress() {
  const [data, setData] = useState<Progress>();
  const [error, setError] = useState("");
  async function load() {
    setError("");
    try { setData(await api<Progress>(`/profile/progress?offset_minutes=${-new Date().getTimezoneOffset()}`)); }
    catch { setError("Your progress could not be loaded."); }
  }
  useEffect(() => { void load(); }, []);
  if (error) return <Notice kind="error">{error} <button className="text-button" onClick={() => void load()}>Retry</button></Notice>;
  if (!data) return <p role="status">Loading your next steps…</p>;
  return <section className="section-gap" aria-label="Student progress">
    <Card>
      <p className="eyebrow">Small steps, real progress</p>
      <h2>{data.reviewed_today ? "You moved your profile forward today." : "Make five minutes count."}</h2>
      <p>{data.active_days} of the last 7 days with reviewed evidence. A missed day is okay—start again whenever you are ready.</p>
      <div className="progress-week" aria-label="Document review activity over seven days">
        {data.days.map(day => <div key={day.date} className={day.completed ? "progress-day done" : "progress-day"}>
          <span>{new Date(day.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })}</span>
          <b aria-label={`${day.date}: ${day.completed ? "Document reviewed" : "No review recorded"}`}>{day.completed ? "✓" : "·"}</b>
        </div>)}
      </div>
      <div className="student-quests">{data.quests.map(q => <Link className="student-quest" to={q.href} key={q.title}>
        <b>{q.title} →</b><span>{q.detail}</span>
      </Link>)}</div>
      <p className="helper">Activity starts with reviews recorded after this update. These are suggestions, not deadlines.</p>
    </Card>
    {!!data.resumes.length && <Card className="section-gap">
      <h2>Resume check-in</h2>
      <p>Source-based checks, not an ATS score or a guarantee of accuracy. Resume statements remain self-reported.</p>
      {data.resumes.map(r => <details key={r.id} className="resume-check">
        <summary>{r.name} · {r.confirmed ? "Reviewed" : "Needs review"} · {r.issues.length} things to check</summary>
        {r.issues.length ? <ul>{r.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul> : <p>No missing details flagged. Compare the analysis with the original before relying on it.</p>}
        <Link className="text-button" to={`/documents/${r.id}`}>Open resume review →</Link>
      </details>)}
    </Card>}
  </section>;
}
