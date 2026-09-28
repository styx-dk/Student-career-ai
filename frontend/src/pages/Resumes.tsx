import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileText } from "lucide-react";
import { api } from "../lib/api";
import type { JD } from "../types";
import {
  Card,
  Empty,
  Notice,
  PageHeader,
  Pager,
  Spinner,
} from "../components/UI";
type Resume = {
  id: string;
  name: string;
  current_version: number;
  created_at: string;
};
export function Resumes() {
  const [resumes, setResumes] = useState<Resume[]>();
  const [jds, setJds] = useState<JD[]>([]);
  const [confirmed, setConfirmed] = useState(0);
  const [name, setName] = useState("");
  const [jd, setJd] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [download, setDownload] = useState("");
  async function load() {
    setError("");
    try {
      const [r, j, p] = await Promise.all([
        api<Resume[]>("/resumes"),
        api<JD[]>("/job-descriptions"),
        api<{ records: unknown[] }>("/profile/evidence"),
      ]);
      setResumes(r);
      setJds(j);
      setConfirmed(p.records.length);
      const target = sessionStorage.getItem("career-target-role");
      if (j.some((x) => x.id === target)) setJd(target!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load resumes");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function create() {
    setBusy(true);
    setError("");
    try {
      await api("/resumes", {
        method: "POST",
        body: JSON.stringify({ name, job_description_id: jd || null }),
      });
      setName("");
      setNotice(
        "Resume created from confirmed information. Review the exported PDF before sharing.",
      );
      await load();
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create resume");
    } finally {
      setBusy(false);
    }
  }
  async function pdf(id: string) {
    setBusy(true);
    setError("");
    setDownload("");
    try {
      const r = await api<{ url: string }>(`/resumes/${id}/pdf`);
      setDownload(r.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export resume");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="From your profile"
        title="Resumes"
        description="Turn confirmed experience into a focused resume for your next opportunity."
      />
      {error && (
        <Notice kind="error">
          {error}{" "}
          {!resumes && (
            <button className="text-button" onClick={() => void load()}>
              Retry
            </button>
          )}
        </Notice>
      )}
      {notice && <Notice kind="success">{notice}</Notice>}
      {download && (
        <Notice kind="success">
          <a href={download} target="_blank" rel="noopener noreferrer">
            Open your PDF to review or download
          </a>{" "}
          · Link expires in five minutes.
        </Notice>
      )}
      {!resumes ? (
        !error && <Spinner />
      ) : (
        <div className="resume-layout">
          <Card>
            <h2>Create a resume</h2>
            {!confirmed && (
              <Notice>
                First, <Link to="/documents">confirm a document</Link> to add
                evidence to your profile.
              </Notice>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <label>
                Resume name
                <input
                  required
                  maxLength={240}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Data Analyst application"
                />
              </label>
              <label>
                Target role
                <select value={jd} onChange={(e) => setJd(e.target.value)}>
                  <option value="">General resume</option>
                  {jds.map((j) => (
                    <option value={j.id} key={j.id}>
                      {j.job_title || j.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="helper">
                Only confirmed records and their skills are included.
                Confirmation means reviewed by you, not externally verified.
              </p>
              <Link className="text-button" to="/profile">
                Review my source profile
              </Link>
              <button
                className="primary wide"
                disabled={busy || !confirmed || !name.trim()}
              >
                <FileText size={16} />
                {busy ? "Working..." : "Create resume"}
              </button>
            </form>
          </Card>
          <div>
            {resumes.length ? (
              <>
                <div className="resume-list">
                  {resumes.slice((page - 1) * 8, page * 8).map((r) => (
                    <Card key={r.id}>
                      <span className="file-icon">
                        <FileText />
                      </span>
                      <div>
                        <h2>{r.name}</h2>
                        <p>
                          Version {r.current_version} ·{" "}
                          {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => void pdf(r.id)}
                      >
                        <Download size={16} />
                        Export PDF
                      </button>
                    </Card>
                  ))}
                </div>
                <Pager
                  page={page}
                  total={resumes.length}
                  size={8}
                  onChange={setPage}
                />
              </>
            ) : (
              <Empty
                title="No resumes yet"
                description="Build your profile first, then create a general or role-focused resume."
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
