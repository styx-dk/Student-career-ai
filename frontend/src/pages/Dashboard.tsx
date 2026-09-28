import { useEffect, useState } from "react";
import { ArrowRight, FileText, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { DocumentItem } from "../types";
import {
  Card,
  Empty,
  Notice,
  PageHeader,
  Spinner,
  Status,
} from "../components/UI";
export function Dashboard() {
  const [docs, setDocs] = useState<DocumentItem[]>();
  const [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      setDocs(await api("/documents"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workspace");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const review =
    docs?.filter((d) => d.processing_status === "needs_review") || [];
  const confirmed = docs?.filter((d) => d.is_confirmed).length || 0;
  return (
    <>
      <PageHeader
        eyebrow="Your workspace"
        title="A clear view of your next step."
        description="Keep your work organized, understand your strengths and prepare for opportunities."
        action={
          <Link className="primary" to="/documents">
            <Upload size={17} />
            Add documents
          </Link>
        }
      />
      {error && (
        <Notice kind="error">
          {error}{" "}
          <button className="text-button" onClick={() => void load()}>
            Retry
          </button>
        </Notice>
      )}
      {!docs ? (
        !error && <Spinner />
      ) : (
        <>
          <div className="metric-grid">
            <Card>
              <span>Documents</span>
              <strong>{docs.length}</strong>
              <Link to="/documents">
                Open your library <ArrowRight size={15} />
              </Link>
            </Card>
            <Card>
              <span>Awaiting review</span>
              <strong>{review.length}</strong>
              <Link to="/documents?filter=review">
                Review extracted details <ArrowRight size={15} />
              </Link>
            </Card>
            <Card>
              <span>Confirmed documents</span>
              <strong>{confirmed}</strong>
              <Link to="/profile">
                Explore your profile <ArrowRight size={15} />
              </Link>
            </Card>
          </div>
          <Card className="next-step">
            <div>
              <p className="eyebrow">Recommended next step</p>
              <h2>
                {review.length
                  ? "Your analysis is ready to review"
                  : docs.length
                    ? "Explore the experience you have collected"
                    : "Start with one document"}
              </h2>
              <p>
                {review.length
                  ? "Check the summary and select demonstrated skills before adding them to your profile."
                  : "A project report, certificate or internship letter is a useful starting point."}
              </p>
            </div>
            <Link
              className="primary"
              to={
                review[0]
                  ? `/documents/${review[0].id}`
                  : docs.length
                    ? "/profile"
                    : "/documents"
              }
            >
              {review.length
                ? "Review document"
                : docs.length
                  ? "View profile"
                  : "Upload document"}
              <ArrowRight size={16} />
            </Link>
          </Card>
          <div className="two-column section-gap">
            <Card>
              <div className="card-head">
                <h2>Recent documents</h2>
                <Link className="text-button" to="/documents">
                  View all
                </Link>
              </div>
              {docs.length ? (
                docs.slice(0, 5).map((d) => (
                  <Link
                    to={`/documents/${d.id}`}
                    className="record-link"
                    key={d.id}
                  >
                    <FileText size={22} />
                    <span>
                      <b>{d.display_name}</b>
                      <small>
                        {new Date(d.created_at).toLocaleDateString()}
                      </small>
                    </span>
                    <Status value={d.processing_status} />
                  </Link>
                ))
              ) : (
                <Empty
                  title="Your library is empty"
                  description="Upload your first document to begin building your profile."
                />
              )}
            </Card>
            <Card>
              <p className="eyebrow">How your workspace connects</p>
              <h2>From evidence to opportunity</h2>
              <ol className="workflow">
                <li>
                  <b>Organize your documents</b>
                  <p>Keep projects, certificates and other work in folders.</p>
                </li>
                <li>
                  <b>Review what AI found</b>
                  <p>
                    Confirm accurate details. Exclude incidental skill mentions.
                  </p>
                </li>
                <li>
                  <b>Plan your next step</b>
                  <p>
                    Compare your profile with a role, then build a learning
                    plan.
                  </p>
                </li>
              </ol>
              <Link className="secondary" to="/planning/roles">
                Explore a target role <ArrowRight size={15} />
              </Link>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
