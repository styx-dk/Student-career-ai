import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, Notice } from "./UI";

export function DeleteButton({ label = "Delete", title, description, onDelete, disabled = false }: {
  label?: string; title: string; description: string; onDelete: () => Promise<void>; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <>
    <button type="button" className="secondary danger" disabled={disabled || busy} onClick={() => { setError(""); setOpen(true); }}><Trash2 size={15} />{label}</button>
    {open && <Dialog title={title} onClose={() => { if (!busy) setOpen(false); }}>
      <p>{description}</p><p className="helper">This cannot be undone. Download anything you want to keep first.</p>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="button-row">
        <button className="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
        <button className="primary danger" disabled={busy} onClick={async () => {
          setBusy(true); setError("");
          try { await onDelete(); setOpen(false); }
          catch (e) { setError(e instanceof Error ? e.message : "Could not delete. Please retry."); }
          finally { setBusy(false); }
        }}>{busy ? "Deleting…" : "Delete permanently"}</button>
      </div>
    </Dialog>}
  </>;
}
