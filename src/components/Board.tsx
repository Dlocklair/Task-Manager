import { useState } from "react";
import { Plus } from "lucide-react";
import type { Project, StatusKey, Task } from "../types";
import { STATUSES } from "../constants";
import { TaskCard } from "./TaskCard";

interface Props {
  tasks: Task[];
  projects: Project[];
  selectedTaskId: string | null;
  showProject: boolean;
  /** Project that quick-add uses (the selected project, or the fallback). */
  quickAddProject?: Project;
  onSelect: (id: string) => void;
  onMove: (id: string, status: StatusKey) => void;
  onQuickAdd: (title: string, status: StatusKey) => void;
}

export function Board({ tasks, projects, selectedTaskId, showProject, quickAddProject, onSelect, onMove, onQuickAdd }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<StatusKey | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const projectOf = (id: string) => projects.find((p) => p.id === id);

  return (
    <div className="board-scroll">
      <div className="board">
        {STATUSES.map((s) => {
          const list = tasks.filter((t) => t.status === s.key);
          const draft = drafts[s.key] ?? "";
          const submit = () => {
            const title = draft.trim();
            if (!title) return;
            onQuickAdd(title, s.key);
            setDrafts((d) => ({ ...d, [s.key]: "" }));
          };
          return (
            <section
              key={s.key}
              aria-label={s.label}
              className={"column" + (overCol === s.key && dragId ? " drop" : "")}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverCol(s.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) onMove(dragId, s.key);
                setDragId(null);
                setOverCol(null);
              }}
            >
              <div className="column-head">
                <span className="status-dot" style={{ background: s.text, boxShadow: `0 0 0 3px hsl(${s.hsl} / 0.18)` }} />
                <h2>{s.label}</h2>
                <span className="count-pill" style={{ background: `hsl(${s.hsl} / 0.16)`, color: s.text }}>{list.length}</span>
              </div>
              <div className="column-bar" style={{ background: s.text }} />

              <form
                className="quick-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <label className="sr-only" htmlFor={`qa-${s.key}`}>Add a task to {s.label}</label>
                <input
                  id={`qa-${s.key}`}
                  className="input"
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                  placeholder={quickAddProject ? `Add to ${quickAddProject.name}` : "Add a task"}
                />
                <button type="submit" className="btn btn-outline btn-icon" style={{ height: 36, width: 36 }} aria-label={`Add task to ${s.label}`} disabled={!draft.trim()}>
                  <Plus size={16} aria-hidden="true" />
                </button>
              </form>

              {list.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  project={projectOf(t.projectId)}
                  selected={t.id === selectedTaskId}
                  showProject={showProject}
                  onSelect={() => onSelect(t.id)}
                  dragging={dragId === t.id}
                  onDragStart={(e) => {
                    setDragId(t.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", t.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverCol(null);
                  }}
                />
              ))}
              {list.length === 0 && <div className="empty-col meta">No tasks here. Drag a card in or add one above.</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
