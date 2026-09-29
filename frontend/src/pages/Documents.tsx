import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  FileUp,
  FolderPlus,
  FolderOpen,
  Search,
  X,
  Plus,
} from "lucide-react";
import { api } from "../lib/api";
import type { DocumentItem } from "../types";
import { ResumeEntries, type ResumeEntry } from "../components/ResumeEntries";
import { DeleteButton } from "../components/DeleteButton";
import {
  Card,
  Dialog,
  Empty,
  Notice,
  PageHeader,
  Pager,
  SkillChips,
  Spinner,
  Status,
} from "../components/UI";

type Folder = { id: string; name: string; parent_id: string | null };
type Analysis = {
  title: string;
  summary: string;
  document_type: string;
  organization: string | null;
  start_date: string | null;
  end_date: string | null;
  skills: string[];
  mentioned_skills: string[];
  accomplishments: string[];
  uncertainties: string[];
  entries?: ResumeEntry[];
};
type FileItem = Omit<DocumentItem, "extraction" | "confirmed_result"> & {
  document_type: string;
  folder_id: string | null;
  extraction?: Analysis;
  confirmed_result?: Analysis;
  has_confirmed_evidence?: boolean;
  duplicate?: boolean;
};
const documentTabs = ["summary", "skills", "details", "original"];
export function Documents() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const folder = params.get("folder");
  const filter = params.get("filter") || "all";
  const [docs, setDocs] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selected, setSelected] = useState<FileItem>();
  const [draft, setDraft] = useState<Analysis>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("summary");
  const [skillSearch, setSkillSearch] = useState("");
  const [skillPage, setSkillPage] = useState(1);
  const [newSkill, setNewSkill] = useState("");
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [url, setUrl] = useState("");
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  function adopt(doc: FileItem) {
    setSelected(doc);
    setDraft(doc.confirmed_result || doc.extraction);
    setDirty(false);
  }
  async function load() {
    const [d, f] = await Promise.all([
      api<FileItem[]>("/documents"),
      api<Folder[]>("/folders"),
    ]);
    setDocs(d);
    setFolders(f);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setUrl("");
    setTab("summary");
    setDirty(false);
    setSkillSearch("");
    setSkillPage(1);
    Promise.all([
      api<FileItem[]>("/documents"),
      api<Folder[]>("/folders"),
      documentId
        ? api<FileItem>(`/documents/${documentId}`)
        : Promise.resolve(undefined),
    ])
      .then(([d, f, item]) => {
        if (active) {
          setDocs(d);
          setFolders(f);
          setSelected(item);
          setDraft(item?.confirmed_result || item?.extraction);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [documentId]);
  useEffect(() => {
    setPage(1);
  }, [search, folder, filter]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const warnOnLink = (e: MouseEvent) => {
      const link = (e.target as Element).closest("a");
      if (
        !link ||
        link.target === "_blank" ||
        link.getAttribute("href")?.startsWith("#")
      )
        return;
      if (!window.confirm("Leave without saving your review changes?")) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        setDirty(false);
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", warnOnLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", warnOnLink, true);
    };
  }, [dirty]);
  function edit(patch: Partial<Analysis>) {
    if (draft) {
      setDraft({ ...draft, ...patch });
      setDirty(true);
    }
  }
  async function task(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy("");
    }
  }
  async function upload(files: FileList | null) {
    if (!files || busy) return;
    const batch = Array.from(files);
    await task("Preparing upload...", async () => {
      const failures: string[] = [];
      let last: FileItem | undefined;
      let duplicates = 0;
      for (let i = 0; i < batch.length; i++) {
        const file = batch[i];
        try {
          setBusy(`Uploading ${i + 1} of ${batch.length}: ${file.name}`);
          const form = new FormData();
          form.append("file", file);
          if (folder) form.append("folder_id", folder);
          const doc = await api<FileItem>("/documents", {
            method: "POST",
            body: form,
          });
          last = doc;
          if (doc.duplicate) {
            duplicates++;
            continue;
          }
          setBusy(`Analyzing ${i + 1} of ${batch.length}: ${file.name}`);
          last = await api<FileItem>(`/documents/${doc.id}/process`, {
            method: "POST",
          });
        } catch (e) {
          failures.push(
            `${file.name}: ${e instanceof Error ? e.message : "Upload failed"}`,
          );
        }
      }
      await load();
      if (failures.length) {
        setError(failures.join(" · "));
        setMessage(
          "Saved files remain in your library. You can retry analysis from the document page.",
        );
      } else if (batch.length === 1 && last) {
        navigate(`/documents/${last.id}`);
        setMessage(
          duplicates
            ? "This exact file is already in your library. Opened the existing document."
            : "Analysis ready. Review each section before confirming.",
        );
      } else
        setMessage(
          `Upload complete. ${duplicates ? duplicates + " existing files were kept without duplication. " : ""}Open the review queue to check your documents.`,
        );
    });
  }
  async function confirmReview() {
    if (!selected || !draft) return;
    if (!draft.title.trim() || !draft.summary.trim()) {
      setError("A title and summary are required. Check the Summary tab.");
      setTab("summary");
      return;
    }
    await task("Saving confirmed details...", async () => {
      await api(`/documents/${selected.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision: "accept",
          corrected_result: {
            ...draft,
            skills: draft.skills.map((s) => s.trim()).filter(Boolean),
          },
        }),
      });
      adopt(await api<FileItem>(`/documents/${selected.id}`));
      await load();
      setMessage("Saved. Your career profile now includes these details.");
    });
  }
  const current = folders.find((f) => f.id === folder);
  const breadcrumbs: Folder[] = [];
  let ancestor = current;
  const visited = new Set<string>();
  while (ancestor && !visited.has(ancestor.id)) {
    visited.add(ancestor.id);
    breadcrumbs.unshift(ancestor);
    ancestor = folders.find((f) => f.id === ancestor?.parent_id);
  }
  const visible = docs.filter(
    (d) =>
      (search || d.folder_id === folder) &&
      `${d.display_name} ${d.extraction?.summary || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "review"
          ? d.processing_status === "needs_review"
          : filter === "confirmed"
            ? d.has_confirmed_evidence || d.is_confirmed
            : filter === "failed"
              ? d.processing_status === "failed"
              : filter === "resume"
                ? (d.confirmed_result?.document_type || d.extraction?.document_type || d.category) === "resume"
              : true)),
  );
  const actualPage = Math.min(
    page,
    Math.max(1, Math.ceil(visible.length / 20)),
  );
  const skillRows =
    draft?.skills
      .map((name, index) => ({ name, index }))
      .filter((s) =>
        s.name.toLowerCase().includes(skillSearch.toLowerCase()),
      ) || [];
  const actualSkillPage = Math.min(
    skillPage,
    Math.max(1, Math.ceil(skillRows.length / 10)),
  );
  function goBack() {
    if (
      !dirty ||
      window.confirm("Leave this page without saving your review changes?")
    )
      navigate(
        selected?.folder_id
          ? `/documents?folder=${selected.folder_id}`
          : "/documents",
      );
  }
  const notices = (
    <>
      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}
      {busy && <Notice>{busy}</Notice>}
    </>
  );
  if (documentId)
    return (
      <>
        <button
          className="text-button back-link"
          disabled={!!busy}
          onClick={goBack}
        >
          <ArrowLeft size={16} />
          Back to documents
        </button>
        {loading ? (
          <Spinner />
        ) : !selected ? (
          <>
            <Notice kind="error">
              {error || "Document not found or unavailable."}
            </Notice>
            <Link className="secondary" to="/documents">
              Open library
            </Link>
          </>
        ) : (
          <>
            <PageHeader
              eyebrow="Document workspace"
              title={selected.display_name}
              description={`${selected.document_type.toUpperCase()} · ${(selected.file_size / 1024).toFixed(1)} KB · Added ${new Date(selected.created_at).toLocaleDateString()}`}
              action={<Status value={selected.processing_status} />}
            />
            {notices}
            {selected.extraction_error && (
              <Notice kind="error">{selected.extraction_error}</Notice>
            )}
            {selected.has_confirmed_evidence && !selected.is_confirmed && (
              <Notice>
                Your previously confirmed details remain in your profile. This
                new draft will replace them only when you confirm it.
              </Notice>
            )}
            <nav className="tabs" aria-label="Document sections">
              {documentTabs.map((t) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  aria-current={tab === t ? "page" : undefined}
                  onClick={() => setTab(t)}
                >
                  {t}
                  {t === "skills" && draft ? ` (${draft.skills.length})` : ""}
                </button>
              ))}
            </nav>
            <div className="document-workspace">
              <div>
                {tab === "original" ? (
                  <Card>
                    <div className="card-head">
                      <div>
                        <h2>Original document</h2>
                        <p>
                          Private links expire after five minutes. Reload the
                          preview if needed.
                        </p>
                      </div>
                      <button
                        className="secondary"
                        disabled={!!busy}
                        onClick={() =>
                          void task("Loading original...", async () => {
                            const r = await api<{ url: string }>(
                              `/documents/${selected.id}/download`,
                            );
                            setUrl(r.url);
                          })
                        }
                      >
                        {url ? "Refresh preview" : "Load original"}
                      </button>
                    </div>
                    {url ? (
                      <>
                        <a
                          className="text-button section-gap"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open or download original
                        </a>
                        {selected.mime_type === "application/pdf" ? (
                          <iframe
                            title="Original PDF document"
                            className="file-preview"
                            src={url}
                          />
                        ) : selected.mime_type.startsWith("image/") ? (
                          <img
                            className="image-preview"
                            alt={selected.display_name}
                            src={url}
                          />
                        ) : (
                          <p>
                            Use the link above to open this file. Inline preview
                            is available for PDFs and images.
                          </p>
                        )}
                      </>
                    ) : (
                      <Empty
                        title="Your original stays unchanged"
                        description="Load the original to compare it with the extracted information."
                      />
                    )}
                  </Card>
                ) : !draft ? (
                  <Empty
                    title="No analysis available"
                    description="Analyze this document to generate a summary and identify skills."
                    action={
                      <button
                        className="primary"
                        disabled={!!busy}
                        onClick={() =>
                          void task("Analyzing document...", async () =>
                            adopt(
                              await api<FileItem>(
                                `/documents/${selected.id}/process`,
                                { method: "POST" },
                              ),
                            ),
                          )
                        }
                      >
                        Analyze document
                      </button>
                    }
                  />
                ) : tab === "summary" ? (
                  <Card>
                    <p className="eyebrow">
                      {selected.is_confirmed
                        ? "Confirmed information"
                        : "AI draft · Check for accuracy"}
                    </p>
                    <h2>What this document says</h2>
                    {draft.document_type === "resume" && <Notice>This is a self-reported resume. Review the separate education and career entries in <button className="text-button" onClick={() => setTab("details")}>Details</button> before confirming. Entry-level skills, not the overall skill list, are added to your profile.</Notice>}
                    <label>
                      Title
                      <input
                        maxLength={240}
                        value={draft.title}
                        disabled={!!busy}
                        onChange={(e) => edit({ title: e.target.value })}
                      />
                    </label>
                    <label>
                      Summary
                      <textarea
                        rows={7}
                        value={draft.summary}
                        disabled={!!busy}
                        onChange={(e) => edit({ summary: e.target.value })}
                      />
                    </label>
                    {draft.uncertainties.length > 0 && (
                      <details open>
                        <summary>
                          Details to check ({draft.uncertainties.length})
                        </summary>
                        <ul>
                          {draft.uncertainties.map((u, i) => (
                            <li key={i}>{u}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <p className="helper">
                      Correct anything that the document does not support before
                      confirming.
                    </p>
                  </Card>
                ) : tab === "skills" ? (
                  <Card>
                    <h2>Demonstrated skills</h2>
                    {draft.document_type === "resume" && <Notice>This is the resume-wide inventory. Edit the skills on each <button className="text-button" onClick={() => setTab("details")}>career entry in Details</button> to change what is added to your profile.</Notice>}
                    <p>
                      Keep skills supported by your work. Edit a name or exclude
                      an incorrect extraction.
                    </p>
                    <div className="search section-gap">
                      <Search />
                      <input
                        aria-label="Search extracted skills"
                        placeholder="Search extracted skills"
                        value={skillSearch}
                        onChange={(e) => {
                          setSkillSearch(e.target.value);
                          setSkillPage(1);
                        }}
                      />
                    </div>
                    {skillRows
                      .slice((actualSkillPage - 1) * 10, actualSkillPage * 10)
                      .map(({ name, index }) => (
                        <div className="skill-edit" key={index}>
                          <input
                            aria-label={`Skill ${index + 1}`}
                            value={name}
                            disabled={!!busy}
                            onChange={(e) =>
                              edit({
                                skills: draft.skills.map((s, i) =>
                                  i === index ? e.target.value : s,
                                ),
                              })
                            }
                          />
                          <button
                            className="secondary"
                            disabled={!!busy}
                            onClick={() =>
                              edit({
                                skills: draft.skills.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            <X size={15} />
                            Exclude
                          </button>
                        </div>
                      ))}
                    <Pager
                      page={actualSkillPage}
                      total={skillRows.length}
                      size={10}
                      onChange={setSkillPage}
                    />
                    <form
                      className="toolbar"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newSkill.trim()) {
                          edit({ skills: [...draft.skills, newSkill.trim()] });
                          setNewSkill("");
                          setSkillSearch("");
                          setSkillPage(
                            Math.ceil((draft.skills.length + 1) / 10),
                          );
                        }
                      }}
                    >
                      <input
                        aria-label="Add a demonstrated skill"
                        placeholder="Add a missing skill"
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                      />
                      <button
                        className="secondary"
                        disabled={!!busy || !newSkill.trim()}
                      >
                        <Plus size={16} />
                        Add
                      </button>
                    </form>
                    {!!draft.mentioned_skills.length && (
                      <details>
                        <summary>
                          Mentioned only — not added to profile (
                          {draft.mentioned_skills.length})
                        </summary>
                        <SkillChips
                          skills={draft.mentioned_skills}
                          limit={draft.mentioned_skills.length}
                        />
                      </details>
                    )}
                  </Card>
                ) : (
                  <Card>
                    <h2>Extracted details</h2>
                    {draft.document_type === "resume" && <ResumeEntries entries={draft.entries || []} onChange={entries => edit({ entries })} disabled={!!busy} />}
                    <div className="form-grid">
                      <label>
                        Category
                        <select
                          value={draft.document_type}
                          disabled={!!busy}
                          onChange={(e) =>
                            edit({ document_type: e.target.value })
                          }
                        >
                          {[
                            "resume",
                            "project",
                            "internship",
                            "certification",
                            "workshop",
                            "achievement",
                            "education",
                            "other",
                          ].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Organization
                        <input
                          value={draft.organization || ""}
                          disabled={!!busy}
                          onChange={(e) =>
                            edit({ organization: e.target.value || null })
                          }
                        />
                      </label>
                      <label>
                        Start / issue date
                        <input
                          type="date"
                          value={draft.start_date || ""}
                          disabled={!!busy}
                          onChange={(e) =>
                            edit({ start_date: e.target.value || null })
                          }
                        />
                      </label>
                      <label>
                        End date
                        <input
                          type="date"
                          value={draft.end_date || ""}
                          min={draft.start_date || undefined}
                          disabled={!!busy}
                          onChange={(e) =>
                            edit({ end_date: e.target.value || null })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Accomplishments — one per line
                      <textarea
                        rows={6}
                        value={draft.accomplishments.join("\n")}
                        disabled={!!busy}
                        onChange={(e) =>
                          edit({ accomplishments: e.target.value.split("\n") })
                        }
                      />
                    </label>
                    <p className="helper">
                      Leave unknown dates blank. Upload dates are not
                      achievement dates.
                    </p>
                  </Card>
                )}
              </div>
              <aside className="detail-rail">
                <Card>
                  <p className="eyebrow">Profile update</p>
                  <h2>
                    {selected.is_confirmed
                      ? "Reviewed by you"
                      : "Ready for your review"}
                  </h2>
                  <p>
                    Review the summary, skills and details. Confirming adds them
                    to your career profile.
                  </p>
                  {draft && (
                    <>
                      <button
                        className="primary wide"
                        disabled={!!busy}
                        onClick={() => void confirmReview()}
                      >
                        {dirty
                          ? "Save corrections & update profile"
                          : selected.is_confirmed
                            ? "Update confirmed details"
                            : "Confirm & update profile"}
                      </button>
                      {!selected.is_confirmed && (
                        <button
                          className="secondary wide"
                          disabled={!!busy}
                          onClick={() =>
                            void task("Rejecting draft...", async () => {
                              await api(`/documents/${selected.id}/review`, {
                                method: "POST",
                                body: JSON.stringify({ decision: "reject" }),
                              });
                              adopt(
                                await api<FileItem>(
                                  `/documents/${selected.id}`,
                                ),
                              );
                              setMessage(
                                "Draft rejected. Previous confirmed information is unchanged.",
                              );
                            })
                          }
                        >
                          Reject draft
                        </button>
                      )}
                    </>
                  )}
                  <Link className="text-button section-gap" to="/profile">
                    View career profile
                  </Link>
                </Card>
                <Card>
                  <h2>File settings</h2>
                  <label>
                    File name
                    <input
                      maxLength={255}
                      value={selected.display_name}
                      disabled={!!busy}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          display_name: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Folder
                    <select
                      value={selected.folder_id || ""}
                      disabled={!!busy}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          folder_id: e.target.value || null,
                        })
                      }
                    >
                      <option value="">My documents</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="secondary wide"
                    disabled={!!busy || !selected.display_name.trim()}
                    onClick={() =>
                      void task("Saving file settings...", async () => {
                        await api(`/documents/${selected.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({
                            display_name: selected.display_name,
                            folder_id: selected.folder_id,
                          }),
                        });
                        setMessage("File settings saved.");
                        await load();
                      })
                    }
                  >
                    Save file settings
                  </button>
                  <button
                    className="text-button section-gap"
                    disabled={!!busy}
                    onClick={() => {
                      if (
                        dirty &&
                        !window.confirm(
                          "Reanalysis will discard unsaved review changes. Continue?",
                        )
                      )
                        return;
                      void task("Analyzing document...", async () =>
                        adopt(
                          await api<FileItem>(
                            `/documents/${selected.id}/process`,
                            { method: "POST" },
                          ),
                        ),
                      );
                    }}
                  >
                    Reanalyze with AI
                  </button>
                  <button
                    className="text-button danger section-gap"
                    disabled={!!busy}
                    onClick={() => setDeleteDialog(true)}
                  >
                    Delete document
                  </button>
                </Card>
              </aside>
            </div>
            {deleteDialog && (
              <Dialog
                title="Delete this document?"
                onClose={() => {
                  if (!busy) setDeleteDialog(false);
                }}
              >
                <p>
                  This removes the original file and its extracted career
                  evidence. This cannot be undone. Your profile summary will be
                  rebuilt.
                </p>
                {error && <Notice kind="error">{error}</Notice>}
                <div className="button-row">
                  <button
                    className="secondary"
                    disabled={!!busy}
                    onClick={() => setDeleteDialog(false)}
                  >
                    Keep document
                  </button>
                  <button
                    className="primary danger-button"
                    disabled={!!busy}
                    onClick={() =>
                      void task("Deleting document...", async () => {
                        await api(`/documents/${selected.id}`, {
                          method: "DELETE",
                        });
                        setDeleteDialog(false);
                        setDirty(false);
                        navigate("/documents");
                      })
                    }
                  >
                    Delete permanently
                  </button>
                </div>
              </Dialog>
            )}
          </>
        )}
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Your private library"
        title="Documents"
        description="Organize your work in folders. Review AI analysis before it becomes part of your profile."
        action={
          <button
            className="primary"
            disabled={!!busy}
            onClick={() => fileInput.current?.click()}
          >
            <FileUp size={17} />
            Upload documents
          </button>
        }
      />
      <input
        ref={fileInput}
        hidden
        multiple
        type="file"
        accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
      {notices}
      <div
        className={`upload-strip ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
      >
        <FileUp size={24} />
        <div>
          <b>Drop files here to upload and analyze</b>
          <p>
            PDF, Word, PowerPoint, text or images. File content is sent to your
            configured AI provider.
          </p>
        </div>
      </div>
      <Card>
        {folder && folders.some(f => f.id === folder) && <div className="button-row"><DeleteButton label="Delete folder" title={`Delete “${folders.find(f => f.id === folder)?.name}”?`} description="Only empty folders can be deleted. Move or delete the documents and subfolders inside first; this will not recursively delete your files." disabled={!!busy} onDelete={async () => {
          const parent = folders.find(f => f.id === folder)?.parent_id;
          await api(`/folders/${folder}`, { method: "DELETE" });
          setFolders(current => current.filter(f => f.id !== folder));
          navigate(parent ? `/documents?folder=${parent}` : "/documents");
          setMessage("Empty folder deleted.");
        }} /></div>}
        <div className="card-head">
          <nav className="breadcrumbs" aria-label="Folder path">
            <Link to="/documents" onClick={() => setSearch("")}>
              My documents
            </Link>
            {breadcrumbs.map((f) => (
              <span key={f.id}>
                {" "}
                /{" "}
                <Link
                  to={`/documents?folder=${f.id}`}
                  onClick={() => setSearch("")}
                >
                  {f.name}
                </Link>
              </span>
            ))}
          </nav>
          <button
            className="secondary"
            disabled={!!busy}
            onClick={() => setFolderDialog(true)}
          >
            <FolderPlus size={16} />
            New folder
          </button>
        </div>
        <div className="toolbar section-gap">
          <div className="search">
            <Search />
            <input
              aria-label="Search documents"
              placeholder="Search all documents and summaries"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Document status"
            value={filter}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              next.set("filter", e.target.value);
              setParams(next);
            }}
          >
            <option value="all">All statuses</option>
            <option value="review">Needs review</option>
            <option value="confirmed">Confirmed evidence</option>
            <option value="failed">Needs attention</option>
            <option value="resume">Resumes</option>
          </select>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          <>
            {!search && (
              <div className="folder-grid">
                {folders
                  .filter((f) => f.parent_id === folder)
                  .map((f) => (
                    <Link
                      className="folder-tile"
                      key={f.id}
                      to={`/documents?folder=${f.id}`}
                    >
                      <FolderOpen size={25} />
                      <b>{f.name}</b>
                      <small>
                        {docs.filter((d) => d.folder_id === f.id).length}{" "}
                        documents
                      </small>
                    </Link>
                  ))}
              </div>
            )}
            {visible.length ? (
              <>
                <div className="file-table">
                  <div className="file-table-head">
                    <span>Document</span>
                    <span>Status</span>
                    <span>Added</span>
                  </div>
                  {visible
                    .slice((actualPage - 1) * 20, actualPage * 20)
                    .map((d) => (
                      <Link
                        className="file-row"
                        key={d.id}
                        to={`/documents/${d.id}`}
                      >
                        <div>
                          <span className="file-icon">
                            <FileText size={22} />
                          </span>
                          <span>
                            <b>{d.display_name}</b>
                            <p>
                              {(d.confirmed_result || d.extraction)?.summary ||
                                "Open to analyze this document."}
                            </p>
                            <small>
                              {d.document_type.toUpperCase()} ·{" "}
                              {(d.file_size / 1024).toFixed(1)} KB
                            </small>
                          </span>
                        </div>
                        <Status value={d.processing_status} />
                        <small>
                          {new Date(d.created_at).toLocaleDateString()}
                        </small>
                      </Link>
                    ))}
                </div>
                <Pager
                  page={actualPage}
                  total={visible.length}
                  size={20}
                  onChange={setPage}
                />
              </>
            ) : (
              <Empty
                title={
                  search || filter !== "all"
                    ? "No matching documents"
                    : "No documents in this folder"
                }
                description={
                  search || filter !== "all"
                    ? "Try another search or status filter."
                    : "Upload a project report, certificate or other evidence of your work."
                }
              />
            )}
          </>
        )}
      </Card>
      {folderDialog && (
        <Dialog
          title="Create a folder"
          onClose={() => {
            if (!busy) setFolderDialog(false);
          }}
        >
          <p>Inside {current?.name || "My documents"}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task("Creating folder...", async () => {
                await api("/folders", {
                  method: "POST",
                  body: JSON.stringify({
                    name: folderName.trim(),
                    parent_id: folder,
                  }),
                });
                await load();
                setFolderDialog(false);
                setFolderName("");
              });
            }}
          >
            <label>
              Folder name
              <input
                autoFocus
                required
                maxLength={160}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Projects or Certificates"
              />
            </label>
            {error && <Notice kind="error">{error}</Notice>}
            <div className="button-row">
              <button
                type="button"
                className="secondary"
                disabled={!!busy}
                onClick={() => setFolderDialog(false)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={!!busy || !folderName.trim()}
              >
                Create folder
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
