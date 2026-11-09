import { useState } from "react";
import { Plus } from "lucide-react";
import type { Project, SortKey, StatusKey, Task } from "../types";
import { STATUSES } from "../constants";
import { TaskCard } from "./TaskCard";

interface Props {
  tasks: Task[];
  projects: Project[];
  selectedTaskId: string | null;
  showProject: boolean;
  sort: SortKey;
  /** Project that quick-add uses (the selected project, or the fallback). */
  quickAddProject?: Project;
  onSelect: (id: string) => void;
  onMove: (id: string, status: StatusKey) => void;
  onReorder: (id: string, targetId: string, place: "before" | "after") => void;
  onQuickAdd: (title: string, status: StatusKey) => void;
}

export function Board({ tasks, projects, selectedTaskId, showProject, sort, quickAddProject, onSelect, onMove, onReorder, onQuickAdd }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<StatusKey | null>(null);
  const [cardDrop, setCardDrop] = useState<{ id: string; place: "before" | "after" } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const projectOf = (id: string) => projects.find((p) => p.id === id);
  const dragTask = tasks.find((t) => t.id === dragId);

  /** On the board, columns are statuses, so a card can be dropped onto any card of the same priority. */
  const canDropOnCard = (target: Task) =>
    !!dragTask &&
    dragTask.id !== target.id &&
    dragTask.priority === target.priority &&
    sort !== "due" &&
    (sort !== "project" || dragTask.projectId === target.projectId);

  const endDrag = () => {
    setDragId(null);
    setOverCol(null);
    setCardDrop(null);
  };

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
              className={"column" + (overCol === s.key && dragId && !cardDrop ? " drop" : "")}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                if (cardDrop) setCardDrop(null);
                setOverCol(s.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragTask?.status !== s.key) onMove(dragId, s.key);
                endDrag();
              }}
            >
              <div className="column-head">
                <span className="status-dot" style={{ background: s.text, boxShadow: `0 0 0 3px hsl(${s.hsl} / 0.18)` }} />
                <h2>{s.label}</h2>
                <span className="count-pill" style={{ background: `hsl(${s.hsl} / 0.16)`, color: s.text }}>{list.length}</span>
              </div>
              <div className="column-bar" style={{ background: s.text }} />

              <form className="quick-add" onSubmit={(e) => { e.preventDefault(); submit(); }}>
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
                <div
                  key={t.id}
                  className={"card-slot" + (cardDrop?.id === t.id ? ` drop-${cardDrop.place}` : "")}
                  onDragOver={(e) => {
                    if (!canDropOnCard(t)) return; // let the column handle it (status change)
                    e.preventDefault();
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    const place = e.clientY < r.top + r.height / 2 ? "before" : "after";
                    if (cardDrop?.id !== t.id || cardDrop.place !== place) setCardDrop({ id: t.id, place });
                    if (overCol) setOverCol(null);
                  }}
                  onDrop={(e) => {
                    if (!dragTask || !canDropOnCard(t) || !cardDrop) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragTask.status !== t.status) onMove(dragTask.id, t.status);
                    onReorder(dragTask.id, t.id, cardDrop.place);
                    endDrag();
                  }}
                >
                  <TaskCard
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
                    onDragEnd={endDrag}
                  />
                </div>
              ))}
              {list.length === 0 && <div className="empty-col meta">No tasks here. Drag a card in or add one above.</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
