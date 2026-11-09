import { useState } from "react";
import { Dialog } from "./Dialog";
import type { Filters, Project, SavedView } from "../types";
import { describeFilters } from "../filters";

interface Props {
  /** Editing an existing saved view; omit to save a new one. */
  view?: SavedView;
  /** The filters currently on screen. */
  current: Filters;
  projects: Project[];
  onSave: (name: string, filters: Filters) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function SavedViewDialog({ view, current, projects, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(view?.name ?? "");
  const [useCurrent, setUseCurrent] = useState(!view);
  const [confirming, setConfirming] = useState(false);
  const filters = useCurrent || !view ? current : view.filters;

  return (
    <Dialog title={view ? "Edit saved view" : "Save view"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim(), filters);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div className="field">
          <label htmlFor="sv-name">Name</label>
          <input id="sv-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High priority due today" maxLength={60} />
        </div>
        <div className="field">
          <span className="label">Shows</span>
          <div className="view-summary">{describeFilters(filters, projects)}</div>
        </div>
        {view && (
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" className="checkbox" checked={useCurrent} onChange={(e) => setUseCurrent(e.target.checked)} />
            Replace with the filters on screen now
          </label>
        )}
        {confirming && <div className="callout">Delete the saved view “{view?.name}”? Your tasks are not affected.</div>}
        <div className="dialog-actions">
          {view && onDelete && !confirming && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Delete view</button>
          )}
          {confirming && <button type="button" className="btn btn-danger-solid" onClick={onDelete}>Yes, delete</button>}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={confirming ? () => setConfirming(false) : onClose}>Cancel</button>
          {!confirming && (
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              {view ? "Save changes" : "Save view"}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
