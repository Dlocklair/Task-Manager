import { useState } from "react";
import { Check } from "lucide-react";
import { Dialog } from "./Dialog";
import { PROJECT_COLORS } from "../constants";
import type { Project } from "../types";
import { plural } from "../utils";

interface Props {
  project?: Project;
  taskCount?: number;
  onSave: (name: string, color: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function ProjectDialog({ project, taskCount = 0, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(project?.name ?? "");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0].hsl);
  const [confirming, setConfirming] = useState(false);
  const editing = !!project;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), color);
  };

  return (
    <Dialog title={editing ? "Edit project" : "New project"} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="field">
          <label htmlFor="project-name">Project name</label>
          <input id="project-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website relaunch" maxLength={60} />
        </div>
        <div className="field">
          <span className="label" id="color-label">Color</span>
          <div className="swatches" role="group" aria-labelledby="color-label">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c.hsl}
                type="button"
                className="swatch"
                aria-pressed={color === c.hsl}
                aria-label={c.name}
                title={c.name}
                style={{ background: `hsl(${c.hsl})` }}
                onClick={() => setColor(c.hsl)}
              >
                {color === c.hsl && <Check size={16} strokeWidth={3} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
        {confirming && (
          <div className="callout">
            Delete “{project?.name}”? This also deletes {plural(taskCount, "task")} in it. This can’t be undone.
          </div>
        )}
        <div className="dialog-actions">
          {editing && onDelete && !confirming && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
              Delete project
            </button>
          )}
          {confirming && (
            <button type="button" className="btn btn-danger-solid" onClick={onDelete}>
              Yes, delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={confirming ? () => setConfirming(false) : onClose}>
            Cancel
          </button>
          {!confirming && (
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              {editing ? "Save project" : "Create project"}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
