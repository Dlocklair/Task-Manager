import { useState } from "react";
import { Info } from "lucide-react";
import { Dialog } from "./Dialog";
import { PRIORITIES, STATUSES } from "../constants";
import type { PriorityKey, Project, StatusKey } from "../types";

export interface NewTaskInput {
  title: string;
  projectId: string;
  status: StatusKey;
  priority: PriorityKey;
  due: string;
  owner: string;
  description: string;
  subtasks: string[];
}

interface Props {
  projects: Project[];
  /** The project selected in the sidebar — new tasks default to it. */
  defaultProjectId: string | null;
  defaultStatus?: StatusKey;
  onCreate: (input: NewTaskInput) => void;
  onClose: () => void;
}

export function AddTaskDialog({ projects, defaultProjectId, defaultStatus = "todo", onCreate, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [status, setStatus] = useState<StatusKey>(defaultStatus);
  const [priority, setPriority] = useState<PriorityKey>("medium");
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [subtaskText, setSubtaskText] = useState("");

  const lockedProject = defaultProjectId ? projects.find((p) => p.id === defaultProjectId) : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    onCreate({
      title: title.trim(),
      projectId,
      status,
      priority,
      due,
      owner: owner.trim(),
      description: description.trim(),
      subtasks: subtaskText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  return (
    <Dialog title="Add Task" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {lockedProject && (
          <div className="hint">
            <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              This task goes into <strong>{lockedProject.name}</strong> because that project is selected. You can change it below.
            </span>
          </div>
        )}
        <div className="field">
          <label htmlFor="nt-title">Task name</label>
          <input id="nt-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to get done?" />
        </div>
        <div className="prop-grid">
          <div className="field">
            <label htmlFor="nt-project">Project</label>
            <select id="nt-project" className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nt-status">Status</label>
            <select id="nt-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as StatusKey)}>
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nt-priority">Priority</label>
            <select id="nt-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value as PriorityKey)}>
              {PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nt-due">Due date</label>
            <input id="nt-due" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="field full">
            <label htmlFor="nt-owner">Owner</label>
            <input id="nt-owner" className="input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who is responsible?" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="nt-desc">Description</label>
          <textarea id="nt-desc" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional — what does done look like?" />
        </div>
        <div className="field">
          <label htmlFor="nt-subs">Subtasks</label>
          <textarea id="nt-subs" className="textarea" value={subtaskText} onChange={(e) => setSubtaskText(e.target.value)} placeholder={"One per line, e.g.\nDraft outline\nGet feedback\nPublish"} />
          <span className="meta">Optional. You can add more subtasks any time from the task’s details.</span>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim() || !projectId}>Add Task</button>
        </div>
      </form>
    </Dialog>
  );
}
