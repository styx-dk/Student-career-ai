import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, FileText } from "lucide-react";
import { api, apiBlob } from "../lib/api";
import { DeleteButton } from "../components/DeleteButton";
import type { JD } from "../types";
import {
  Card,
  Empty,
  Notice,
  PageHeader,
  Pager,
  Spinner,
  Dialog,
  SkillChips,
} from "../components/UI";
type Resume = {
  id: string;
  name: string;
  current_version: number;
  created_at: string;
};
type ResumePreview = { name: string; content: { professional_summary: string; skills: string[]; [key: string]: unknown } };
export function Resumes() {
  const [params, setParams] = useSearchParams();
  const previewId = params.get("preview");
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
  const [preview, setPreview] = useState<ResumePreview>();
  async function openPreview(id: string) {
    setBusy(true); setError("");
    try { setPreview(await api<ResumePreview>(`/resumes/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load preview"); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (previewId) void openPreview(previewId); }, [previewId]);
  useEffect(() => () => { if (download) URL.revokeObjectURL(download); }, [download]);
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
      const blob = await apiBlob(`/resumes/${id}/pdf`);
      setDownload(URL.createObjectURL(blob));
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
          <a href={download} download="career-resume.pdf">
            Open your PDF to review or download
          </a>{" "}
          · Ready to download securely from this browser.
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
                      <div className="resume-buttons">
                      <DeleteButton label="Delete resume" title={`Delete “${r.name}”?`} description="This removes this generated resume, all its saved versions and stored PDF exports. Your uploaded documents, career profile and PDFs already downloaded to your device are kept." disabled={busy} onDelete={async () => {
                        await api(`/resumes/${r.id}`, { method: "DELETE" });
                        setResumes(current => current?.filter(item => item.id !== r.id));
                        setPage(1); setDownload(""); setPreview(undefined);
                        if (previewId === r.id) { const next = new URLSearchParams(params); next.delete("preview"); setParams(next, { replace: true }); }
                        setNotice("Resume deleted. Your documents and profile are unchanged.");
                      }} />
                      <button className="secondary" disabled={busy} onClick={() => void openPreview(r.id)}>Preview</button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => void pdf(r.id)}
                      >
                        <Download size={16} />
                        Export PDF
                      </button>
                      </div>
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
      {preview && <Dialog title={preview.name} onClose={() => setPreview(undefined)}><div className="resume-preview">
        <Notice>Saved snapshot of reviewed information. Compare with your current <Link to="/profile">profile</Link> before sharing.</Notice>
        <h3>Professional summary</h3><p>{preview.content.professional_summary}</p>
        <SkillChips skills={preview.content.skills} limit={12} />
        {["education", "projects", "internships", "certifications", "achievements", "other_experience"].map(section => {
          const items = preview.content[section] as { id: string; title: string; description?: string }[] | undefined;
          return !!items?.length && <section key={section}><h3>{section.replaceAll("_", " ")}</h3>{items.map(item => <article key={item.id}><b>{item.title}</b><p>{item.description}</p></article>)}</section>;
        })}
      </div></Dialog>}
    </>
  );
}
