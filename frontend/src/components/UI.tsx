import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  X,
  FolderOpen,
} from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 title={title}>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FolderOpen size={28} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Spinner() {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={20} /> Loading...
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`status status-${value.toLowerCase().replaceAll(" ", "_")}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function Notice({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`notice ${kind}`}
    >
      <Icon size={18} />
      <span>{children}</span>
    </div>
  );
}
export function Pager({
  page,
  total,
  size,
  onChange,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pages);
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(current - 1) * size + 1}–${Math.min(current * size, total)} of ${total}`
          : "0 results"}
      </span>
      <div>
        <button
          className="secondary"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
        >
          Previous
        </button>
        <span>
          Page {current} of {pages}
        </span>
        <button
          className="secondary"
          disabled={current >= pages}
          onClick={() => onChange(current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function SkillChips({
  skills,
  limit = 3,
}: {
  skills: string[];
  limit?: number;
}) {
  const unique = [...new Set(skills.filter(Boolean))];
  return (
    <div className="chips">
      {unique.slice(0, limit).map((s) => (
        <span key={s}>{s}</span>
      ))}
      {unique.length > limit && <span>+{unique.length - limit} more</span>}
    </div>
  );
}
export function ExpandText({
  text,
  limit = 420,
}: {
  text?: string | null;
  limit?: number;
}) {
  return !text ? (
    <p>No summary available.</p>
  ) : text.length <= limit ? (
    <p className="prose">{text}</p>
  ) : (
    <details className="expand-text">
      <summary>
        {text.slice(0, limit)}… <span>Read full summary</span>
      </summary>
      <p className="prose">{text}</p>
    </details>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="card-head">
        <h2 id={headingId}>{title}</h2>
        <button className="icon" aria-label="Close dialog" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
