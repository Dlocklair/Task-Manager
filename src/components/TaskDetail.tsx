import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ListChecks, NotebookPen, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import type { Project, Task } from "../types";
import type { Action } from "../store";
import { PRIORITIES, STATUSES } from "../constants";
import { DueBadge, PriorityBars, ProjectPill } from "./bits";
import { formatTimestamp } from "../utils";

interface Props {
  task: Task;
  projects: Project[];
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
  onDelete: () => void;
}

function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

export function TaskDetail({ task, projects, dispatch, onClose, onDelete }: Props) {
  const project = projects.find((p) => p.id === task.projectId);
  const [subDraft, setSubDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const subInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSubDraft("");
    setNoteDraft("");
    setEditingNote(null);
    setConfirmDelete(false);
  }, [task.id]);

  const update = (patch: Partial<Task>) => dispatch({ type: "updateTask", id: task.id, patch });
  const doneSubs = task.subtasks.filter((s) => s.done).length;
  const pct = task.subtasks.length ? Math.round((doneSubs / task.subtasks.length) * 100) : 0;
  const isDone = task.status === "done";

  const addSubtask = () => {
    const title = subDraft.trim();
    if (!title) return;
    dispatch({ type: "addSubtask", taskId: task.id, title });
    setSubDraft("");
    subInputRef.current?.focus();
  };
  const addNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    dispatch({ type: "addNote", taskId: task.id, text });
    setNoteDraft("");
  };
  const notesNewestFirst = [...task.notes].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <aside className="detail" aria-label="Task details" data-testid="task-detail">
      <div className="detail-section">
        <div className="detail-head">
          <ProjectPill project={project} />
          <button type="button" className="tiny-btn" onClick={onClose} aria-label="Close details" title="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <label className="sr-only" htmlFor="td-title">Task name</label>
        <AutoTextarea id="td-title" className="title-input" value={task.title} onChange={(e) => update({ title: e.target.value })} onBlur={(e) => !e.target.value.trim() && update({ title: "Untitled task" })} />
        <label className="sr-only" htmlFor="td-desc">Description</label>
        <textarea id="td-desc" className="textarea" value={task.description} onChange={(e) => update({ description: e.target.value })} placeholder="Add a description — what does done look like?" style={{ minHeight: 64, fontSize: 13 }} />
      </div>

      <div className="detail-section">
        <span className="label" id="td-status-label">Status</span>
        <div className="status-grid" role="group" aria-labelledby="td-status-label">
          {STATUSES.map((s) => {
            const on = task.status === s.key;
            return (
              <button
                key={s.key}
                type="button"
                className="status-btn"
                aria-pressed={on}
                onClick={() => dispatch({ type: "setStatus", id: task.id, status: s.key })}
                style={on ? { background: `hsl(${s.hsl} / 0.16)`, borderColor: s.text, color: s.text } : undefined}
              >
                <span className="status-dot" style={{ width: 9, height: 9, background: s.text }} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="detail-section">
        <div className="prop-grid">
          <div className="field full">
            <label htmlFor="td-project">Project</label>
            <select id="td-project" className="select" value={task.projectId} onChange={(e) => update({ projectId: e.target.value })}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="td-priority" style={{ display: "flex", alignItems: "center", gap: 6 }}>Priority <PriorityBars priority={task.priority} size={12} /></label>
            <select id="td-priority" className="select" value={task.priority} onChange={(e) => update({ priority: e.target.value as Task["priority"] })}>
              {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="td-due">Due date</label>
            <input id="td-due" type="date" className="input" value={task.due} onChange={(e) => update({ due: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="td-owner">Owner</label>
            <input id="td-owner" className="input" value={task.owner} onChange={(e) => update({ owner: e.target.value })} placeholder="Unassigned" />
          </div>
          <div className="field">
            <span className="label">Timing</span>
            <span style={{ height: 36, display: "flex", alignItems: "center" }}><DueBadge task={task} /></span>
          </div>
        </div>
      </div>

      {/* Subtasks */}
      <div className="detail-section" aria-labelledby="td-subtasks">
        <div className="section-title">
          <h3 id="td-subtasks"><ListChecks size={16} aria-hidden="true" />Subtasks</h3>
          <span className="meta">{task.subtasks.length ? `${doneSubs} of ${task.subtasks.length} done` : "None yet"}</span>
        </div>
        {task.subtasks.length > 0 && (
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Subtasks complete">
            <div style={{ width: pct + "%" }} />
          </div>
        )}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {task.subtasks.map((s, i) => (
            <li key={s.id} className="subtask" data-testid="subtask">
              <input
                type="checkbox"
                className="checkbox"
                checked={s.done}
                onChange={() => dispatch({ type: "updateSubtask", taskId: task.id, subtaskId: s.id, patch: { done: !s.done } })}
                aria-label={`Mark “${s.title}” ${s.done ? "not done" : "done"}`}
              />
              <input
                className={"sub-input" + (s.done ? " done" : "")}
                value={s.title}
                aria-label="Subtask name"
                onChange={(e) => dispatch({ type: "updateSubtask", taskId: task.id, subtaskId: s.id, patch: { title: e.target.value } })}
                onBlur={(e) => !e.target.value.trim() && dispatch({ type: "deleteSubtask", taskId: task.id, subtaskId: s.id })}
              />
              <span className="row-actions">
                <button type="button" className="tiny-btn" disabled={i === 0} onClick={() => dispatch({ type: "moveSubtask", taskId: task.id, subtaskId: s.id, dir: -1 })} aria-label="Move up" title="Move up">
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button type="button" className="tiny-btn" disabled={i === task.subtasks.length - 1} onClick={() => dispatch({ type: "moveSubtask", taskId: task.id, subtaskId: s.id, dir: 1 })} aria-label="Move down" title="Move down">
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                <button type="button" className="tiny-btn danger" onClick={() => dispatch({ type: "deleteSubtask", taskId: task.id, subtaskId: s.id })} aria-label={`Delete subtask “${s.title}”`} title="Delete subtask">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
        <form className="add-row" onSubmit={(e) => { e.preventDefault(); addSubtask(); }}>
          <label className="sr-only" htmlFor="td-new-sub">New subtask</label>
          <input id="td-new-sub" ref={subInputRef} className="input" value={subDraft} onChange={(e) => setSubDraft(e.target.value)} placeholder="Add a subtask and press Enter" />
          <button type="submit" className="btn btn-outline btn-sm" disabled={!subDraft.trim()} style={{ height: 36 }}>
            <Plus size={14} aria-hidden="true" />Add
          </button>
        </form>
      </div>

      {/* Notes */}
      <div className="detail-section" aria-labelledby="td-notes">
        <div className="section-title">
          <h3 id="td-notes"><NotebookPen size={16} aria-hidden="true" />Notes</h3>
          <span className="meta">{task.notes.length ? `${task.notes.length} ${task.notes.length === 1 ? "note" : "notes"}` : "None yet"}</span>
        </div>
        <label className="sr-only" htmlFor="td-new-note">New note</label>
        <textarea
          id="td-new-note"
          className="textarea"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addNote(); } }}
          placeholder="Write a note — progress, decisions, links…"
          style={{ fontSize: 13 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span className="meta">Ctrl + Enter to add</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={addNote} disabled={!noteDraft.trim()}>
            <Plus size={14} aria-hidden="true" />Add note
          </button>
        </div>
        {notesNewestFirst.map((n) => (
          <div key={n.id} className="note" data-testid="note">
            <div className="note-head">
              <span className="meta">{formatTimestamp(n.createdAt)}</span>
              <span style={{ display: "flex", gap: 2 }}>
                <button type="button" className="tiny-btn" onClick={() => setEditingNote({ id: n.id, text: n.text })} aria-label="Edit note" title="Edit note">
                  <Pencil size={13} aria-hidden="true" />
                </button>
                <button type="button" className="tiny-btn danger" onClick={() => dispatch({ type: "deleteNote", taskId: task.id, noteId: n.id })} aria-label="Delete note" title="Delete note">
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </span>
            </div>
            {editingNote?.id === n.id ? (
              <>
                <textarea className="textarea" aria-label="Edit note" value={editingNote.text} onChange={(e) => setEditingNote({ id: n.id, text: e.target.value })} style={{ fontSize: 13 }} autoFocus />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingNote(null)}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!editingNote.text.trim()}
                    onClick={() => { dispatch({ type: "updateNote", taskId: task.id, noteId: n.id, text: editingNote.text.trim() }); setEditingNote(null); }}
                  >
                    Save note
                  </button>
                </div>
              </>
            ) : (
              <p className="note-text">{n.text}</p>
            )}
          </div>
        ))}
      </div>

      <div className="detail-section">
        {confirmDelete ? (
          <>
            <div className="callout">Delete “{task.title}” with its {task.subtasks.length} subtasks and {task.notes.length} notes?</div>
            <div className="detail-actions">
              <button type="button" className="btn btn-danger-solid" onClick={onDelete}>Yes, delete task</button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <div className="detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => dispatch({ type: "setStatus", id: task.id, status: isDone ? "todo" : "done" })}
            >
              {isDone ? <RotateCcw size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              {isDone ? "Reopen task" : "Mark complete"}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} aria-hidden="true" />Delete
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
