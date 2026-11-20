import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Search, X } from "lucide-react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { Modal } from "./ui";

/**
 * Picks the task that the selected tasks will become subtasks of. Projects are listed first and open to show
 * their tasks (and those tasks' subtasks). Typing in the search box lists matching tasks from every project.
 * The selected tasks, and anything under them, can't be picked: a task can't go under itself.
 */
export function ParentPicker({ ids, onPick, onClose }: { ids: string[]; onPick(parentId: string): void; onClose(): void }) {
  const s = useStore();
  const [q, setQ] = useState("");
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());
  const [openTasks, setOpenTasks] = useState<Set<string>>(new Set());
  const [chosen, setChosen] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  // The selected tasks and everything under them.
  const blocked = useMemo(() => {
    const out = new Set(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of s.data.tasks) if (t.parent_task_id && out.has(t.parent_task_id) && !out.has(t.id)) { out.add(t.id); grew = true; }
    }
    return out;
  }, [ids, s.data.tasks]);

  const usable = (t: Task) => !blocked.has(t.id) && (showDone || t.status !== "done");
  const byPosition = (a: Task, b: Task) => a.position - b.position;
  const kidsOf = (id: string) => s.kids(id).filter(usable);
  const rootsOf = (projectId: string | null) => s.data.tasks.filter((t) => !t.parent_task_id && t.project_id === projectId && usable(t)).sort(byPosition);

  const groups = [
    ...s.data.projects.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    { id: "", name: "No project", color: "#8690a6" },
  ]
    .map((g) => ({ ...g, roots: rootsOf(g.id || null) }))
    .filter((g) => g.roots.length > 0);

  const needle = q.trim().toLowerCase();
  const matches = needle ? s.data.tasks.filter((t) => usable(t) && t.title.toLowerCase().includes(needle)).slice(0, 80) : [];

  const toggle = (set: Set<string>, setter: (v: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  /** "Project › Parent task", so search results with the same name can be told apart. */
  const where = (t: Task) => {
    const parts: string[] = [];
    let p = t.parent_task_id ? s.task(t.parent_task_id) : undefined;
    while (p) {
      parts.unshift(p.title);
      p = p.parent_task_id ? s.task(p.parent_task_id) : undefined;
    }
    parts.unshift(s.project(t.project_id)?.name ?? "No project");
    return parts.join(" › ");
  };

  const TaskLine = ({ task, depth }: { task: Task; depth: number }) => {
    const kids = kidsOf(task.id);
    const open = openTasks.has(task.id);
    return (
      <>
        <div className={"pp-task" + (chosen === task.id ? " on" : "") + (task.status === "done" ? " is-done" : "")} style={{ paddingLeft: 8 + depth * 22 }}>
          {kids.length > 0 ? (
            <button type="button" className={"pp-caret" + (open ? " open" : "")} aria-label={open ? "Hide subtasks" : "Show subtasks"} aria-expanded={open} onClick={() => toggle(openTasks, setOpenTasks, task.id)}>
              <ChevronRight size={15} />
            </button>
          ) : (
            <span className="pp-caret-space" />
          )}
          <button type="button" className="pp-pick" aria-pressed={chosen === task.id} onClick={() => setChosen(task.id)}>
            {task.title}
            {kids.length > 0 && <small>{kids.length} subtask{kids.length === 1 ? "" : "s"}</small>}
          </button>
        </div>
        {open && kids.map((k) => <TaskLine key={k.id} task={k} depth={depth + 1} />)}
      </>
    );
  };

  const target = chosen ? s.task(chosen) : undefined;

  return createPortal(
    <Modal title={`Make ${ids.length} task${ids.length === 1 ? "" : "s"} subtasks of…`} onClose={onClose}>
      <div className="pp">
        <label className="search pp-search">
          <Search size={16} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for a task" aria-label="Search for a task" />
          {q && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQ("")}><X size={14} /></button>}
        </label>
        <label className="check-line pp-done">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Include finished tasks
        </label>

        <div className="pp-list" role="list">
          {needle ? (
            matches.length === 0 ? (
              <p className="field-hint">No tasks match “{q.trim()}”.</p>
            ) : (
              matches.map((t) => (
                <button key={t.id} type="button" className={"pp-result" + (chosen === t.id ? " on" : "")} aria-pressed={chosen === t.id} onClick={() => setChosen(t.id)}>
                  <span>{t.title}</span>
                  <small>{where(t)}</small>
                </button>
              ))
            )
          ) : groups.length === 0 ? (
            <p className="field-hint">There are no other tasks to move these under.</p>
          ) : (
            groups.map((g) => {
              const open = openProjects.has(g.id);
              return (
                <div key={g.id || "none"} className="pp-project">
                  <button type="button" className="pp-project-head" aria-expanded={open} onClick={() => toggle(openProjects, setOpenProjects, g.id)}>
                    <ChevronRight size={16} className={open ? "flip-90" : ""} />
                    <i style={{ background: g.color }} />
                    <span className="grow">{g.name}</span>
                    <small>{g.roots.length}</small>
                  </button>
                  {open && <div className="pp-tasks">{g.roots.map((t) => <TaskLine key={t.id} task={t} depth={0} />)}</div>}
                </div>
              );
            })
          )}
        </div>

        <div className="form-actions pp-foot">
          <span className="grow pp-chosen">{target ? <>Under: <strong>{target.title}</strong></> : "Pick a task above."}</span>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>Move here</button>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}
