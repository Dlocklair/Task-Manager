import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from "lucide-react";
import type { Project, SortDir, SortKey, StatusKey, Task } from "../types";
import { canReorder } from "../filters";
import { Avatar, DueBadge, PriorityLabel, StatusSelect } from "./bits";
import { shortDate } from "../utils";

interface Props {
  tasks: Task[];
  projects: Project[];
  selectedTaskId: string | null;
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: StatusKey) => void;
  onReorder: (id: string, targetId: string, place: "before" | "after") => void;
}

function SortHeader({ label, k, sort, dir, onSort }: { label: string; k: SortKey; sort: SortKey; dir: SortDir; onSort: (k: SortKey) => void }) {
  const on = sort === k;
  const Icon = !on ? ArrowUpDown : dir === "asc" ? ArrowDown : ArrowUp;
  return (
    <th scope="col" aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={"sort-btn" + (on ? " on" : "")} onClick={() => onSort(k)} title={`Sort by ${label.toLowerCase()}`}>
        {label}
        <Icon size={13} aria-hidden="true" />
      </button>
    </th>
  );
}

export function ListView({ tasks, projects, selectedTaskId, sort, dir, onSort, onSelect, onStatus, onReorder }: Props) {
  const projectOf = (id: string) => projects.find((p) => p.id === id);
  const [armed, setArmed] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; place: "before" | "after" } | null>(null);
  const dragTask = tasks.find((t) => t.id === dragId);
  const reorderable = sort !== "due";

  const keyboardMove = (t: Task, delta: -1 | 1) => {
    const i = tasks.findIndex((x) => x.id === t.id);
    for (let j = i + delta; j >= 0 && j < tasks.length; j += delta) {
      if (canReorder(t, tasks[j], sort)) {
        onReorder(t.id, tasks[j].id, delta < 0 ? "before" : "after");
        return;
      }
    }
  };

  return (
    <div className="list-wrap">
      <p className="meta list-hint">
        {reorderable
          ? "Drag the ⋮⋮ handle to reorder tasks that share the same priority (or focus it and use the arrow keys)."
          : "Sorted by due date. Sort by priority, status or project to drag tasks into your own order."}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: 36 }}><span className="sr-only">Reorder</span></th>
              <th scope="col" style={{ paddingLeft: 4 }}>Task</th>
              <SortHeader label="Status" k="status" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label="Priority" k="priority" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label="Project" k="project" sort={sort} dir={dir} onSort={onSort} />
              <SortHeader label="Due date" k="due" sort={sort} dir={dir} onSort={onSort} />
              <th scope="col">Subtasks</th>
              <th scope="col">Owner</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const p = projectOf(t.projectId);
              const done = t.subtasks.filter((s) => s.done).length;
              const isDropTarget = drop?.id === t.id;
              const blocked = !!dragTask && dragTask.id !== t.id && !canReorder(dragTask, t, sort);
              return (
                <tr
                  key={t.id}
                  data-testid="list-row"
                  className={[
                    t.id === selectedTaskId ? "selected" : "",
                    dragId === t.id ? "dragging" : "",
                    blocked ? "blocked" : "",
                    isDropTarget ? `drop-${drop!.place}` : "",
                  ].join(" ")}
                  draggable={armed === t.id}
                  onDragStart={(e) => {
                    setDragId(t.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", t.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDrop(null);
                    setArmed(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragTask || !canReorder(dragTask, t, sort)) return;
                    e.preventDefault();
                    const r = e.currentTarget.getBoundingClientRect();
                    const place = e.clientY < r.top + r.height / 2 ? "before" : "after";
                    if (drop?.id !== t.id || drop.place !== place) setDrop({ id: t.id, place });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragTask && drop && canReorder(dragTask, t, sort)) onReorder(dragTask.id, t.id, drop.place);
                    setDragId(null);
                    setDrop(null);
                    setArmed(null);
                  }}
                >
                  <td style={{ paddingLeft: 8, paddingRight: 0 }}>
                    {reorderable && (
                      <button
                        type="button"
                        className="grip"
                        aria-label={`Reorder “${t.title}”. Use up and down arrow keys.`}
                        title="Drag to reorder within the same priority"
                        onMouseDown={() => setArmed(t.id)}
                        onMouseUp={() => !dragId && setArmed(null)}
                        onTouchStart={() => setArmed(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") { e.preventDefault(); keyboardMove(t, -1); }
                          if (e.key === "ArrowDown") { e.preventDefault(); keyboardMove(t, 1); }
                        }}
                      >
                        <GripVertical size={16} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                  <td style={{ paddingLeft: 4 }}>
                    <button
                      type="button"
                      className="row-title"
                      onClick={() => onSelect(t.id)}
                      style={t.status === "done" ? { textDecoration: "line-through", color: "hsl(var(--muted-foreground))" } : undefined}
                    >
                      {t.title}
                    </button>
                  </td>
                  <td>
                    <StatusSelect compact status={t.status} onChange={(s) => onStatus(t.id, s)} label={`Status of ${t.title}`} />
                  </td>
                  <td><PriorityLabel priority={t.priority} /></td>
                  <td>
                    {p && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, whiteSpace: "nowrap" }}>
                        <span className="project-swatch" style={{ background: `hsl(${p.color})`, width: 9, height: 9 }} />
                        {p.name}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", minWidth: 62 }}>{t.due ? shortDate(t.due) : <span className="muted">—</span>}</span>
                      {(t.due || t.status === "done") && <DueBadge task={t} />}
                    </span>
                  </td>
                  <td className="meta">{t.subtasks.length ? `${done}/${t.subtasks.length}` : "—"}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, whiteSpace: "nowrap" }}>
                      <Avatar name={t.owner} />
                      {t.owner || <span className="muted">Unassigned</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tasks.length === 0 && <div className="meta" style={{ padding: 32, textAlign: "center" }}>No tasks match these filters.</div>}
      </div>
    </div>
  );
}
