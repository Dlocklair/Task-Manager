import { useState } from "react";
import { ChevronDown, Columns3, LayoutList, Pencil } from "lucide-react";
import { useStore } from "../lib/store";
import type { Project, Task } from "../lib/types";
import { sortCompare, STATUSES, step, tint } from "../lib/util";
import { QuickAdd, TaskRow } from "./TaskList";
import { AvatarStack, Check, DueBadge, Empty, PriorityFlag } from "./ui";

type Step = "todo" | "in_progress" | "done";
type SortKey = "due" | "priority" | "assigned" | "name";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "due", label: "Due date" },
  { id: "priority", label: "Priority" },
  { id: "assigned", label: "Assigned to" },
  { id: "name", label: "Name" },
];

export function ProjectView({ project, onEdit }: { project: Project; onEdit(): void }) {
  const s = useStore();
  const [mode, setMode] = useState<"list" | "board">("list");
  const [showDone, setShowDone] = useState(false);
  const [who, setWho] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("due");
  const allTasks = s.topLevel(project.id);
  // Filtering is by the task's own assignees. Subtasks are not filtered separately.
  const tasks = allTasks.filter((t) => {
    if (who === "all") return true;
    const people = s.assigned(t.id);
    return who === "none" ? people.length === 0 : people.some((p) => p.id === who);
  });
  const prog = s.progress(project.id);
  const groups: Record<Step, Task[]> = { in_progress: [], todo: [], done: [] };
  for (const t of tasks) groups[step(t.status)].push(t);
  const cmp = sortCompare(sortBy, (id) => s.assigned(id)[0]?.full_name ?? "");
  groups.todo.sort(cmp);
  groups.in_progress.sort(cmp);
  if (sortBy === "due") groups.done.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  else groups.done.sort(cmp);

  return (
    <div className="page" style={tint(project.color)}>
      <header className="banner">
        <div className="banner-top">
          <h1>{project.name}</h1>
          <button className="icon-btn on-color" onClick={onEdit} aria-label="Edit project"><Pencil size={17} /></button>
        </div>
        <div className="banner-stats">
          <div className="bar" role="img" aria-label={`${prog.pct}% complete`}><span style={{ width: `${prog.pct}%` }} /></div>
          <span>{prog.done} of {prog.total} done</span>
          {prog.late > 0 && <span className="late-pill">{prog.late} overdue</span>}
        </div>
      </header>

      <div className="toolbar">
        <QuickAdd placeholder={`Add a task to ${project.name}`} onAdd={(title) => s.openTask(s.addTask({ project_id: project.id, title }))} />
        <div className="seg" role="tablist" aria-label="Layout">
          <button role="tab" aria-selected={mode === "list"} className={mode === "list" ? "on" : ""} onClick={() => setMode("list")}><LayoutList size={16} />List</button>
          <button role="tab" aria-selected={mode === "board"} className={mode === "board" ? "on" : ""} onClick={() => setMode("board")}><Columns3 size={16} />Board</button>
        </div>
      </div>

      {allTasks.length > 0 && (
        <div className="view-tools" role="group" aria-label="Filter and sort tasks">
          <label>
            <span>Assigned to</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">Everyone</option>
              <option value="none">Nobody yet</option>
              {[...s.data.people].sort((a, b) => a.full_name.localeCompare(b.full_name)).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Sort by</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
              {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          {(who !== "all" || sortBy !== "due") && (
            <button className="btn small" onClick={() => { setWho("all"); setSortBy("due"); }}>Reset</button>
          )}
          <span className="view-count">Showing {tasks.length} of {allTasks.length}</span>
        </div>
      )}

      {allTasks.length === 0 ? (
        <Empty title="This project has no tasks yet">Type the first one in the box above and press Enter.</Empty>
      ) : tasks.length === 0 ? (
        <Empty title="No tasks match this filter">Choose Everyone above to see all of them.</Empty>
      ) : mode === "list" ? (
        <>
          {(["in_progress", "todo"] as Step[]).map((g) =>
            groups[g].length ? (
              <section key={g} className="group">
                <h2 className={`group-head ${g}`}><i />{STATUSES.find((x) => x.id === g)!.label}<span>{groups[g].length}</span></h2>
                <div className="rows">{groups[g].map((t) => <TaskRow key={t.id} task={t} />)}</div>
              </section>
            ) : null,
          )}
          {groups.done.length > 0 && (
            <section className="group">
              <button className="group-head done as-button" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
                <i />Done<span>{groups.done.length}</span><ChevronDown size={16} className={showDone ? "flip" : ""} />
              </button>
              {showDone && <div className="rows">{groups.done.map((t) => <TaskRow key={t.id} task={t} />)}</div>}
            </section>
          )}
        </>
      ) : (
        <Board groups={groups} projectId={project.id} />
      )}
    </div>
  );
}

function Board({ groups, projectId }: { groups: Record<Step, Task[]>; projectId: string }) {
  const s = useStore();
  const [over, setOver] = useState<Step | null>(null);
  return (
    <div className="board">
      {(["todo", "in_progress", "done"] as Step[]).map((g) => (
        <section
          key={g}
          className={"column" + (over === g ? " drop" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(g);
          }}
          onDragLeave={() => setOver((o) => (o === g ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            setOver(null);
            const id = e.dataTransfer.getData("text/task");
            const t = id ? s.task(id) : undefined;
            if (t && step(t.status) !== g) s.updateTask(id, { status: g });
          }}
        >
          <h2 className={`group-head ${g}`}><i />{STATUSES.find((x) => x.id === g)!.label}<span>{groups[g].length}</span></h2>
          <div className="cards">
            {groups[g].map((t) => <Card key={t.id} task={t} />)}
            {g !== "done" && <QuickAdd placeholder="Add a task" onAdd={(title) => s.openTask(s.addTask({ project_id: projectId, title, status: g }))} />}
          </div>
        </section>
      ))}
    </div>
  );
}

function Card({ task }: { task: Task }) {
  const s = useStore();
  const kids = s.kids(task.id);
  const doneKids = kids.filter((k) => k.status === "done").length;
  const done = task.status === "done";
  const picked = s.selection.has(task.id);
  return (
    <article
      className={"card" + (done ? " is-done" : "") + (s.selectedId === task.id ? " is-selected" : "") + (picked ? " is-picked" : "")}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/task", task.id)}
      onClick={() => s.openTask(task.id)}
      onKeyDown={(e) => e.key === "Enter" && s.openTask(task.id)}
      tabIndex={0}
    >
      <div className="card-top">
        <input
          type="checkbox"
          className="pick-tick"
          checked={picked}
          aria-label={`Select ${task.title}`}
          onClick={(e) => e.stopPropagation()}
          onChange={() => s.toggleSelect(task.id)}
        />
        <Check done={done} label={task.title} onToggle={() => s.updateTask(task.id, { status: done ? "todo" : "done" })} />
        <span className="row-title">{task.title}</span>
      </div>
      {kids.length > 0 && (
        <div className="card-sub">
          <div className="bar thin"><span style={{ width: `${(100 * doneKids) / kids.length}%` }} /></div>
          {doneKids}/{kids.length} subtasks
        </div>
      )}
      <div className="card-foot">
        <DueBadge task={task} />
        <PriorityFlag priority={task.priority} />
        <span className="grow" />
        <AvatarStack people={s.assigned(task.id)} />
      </div>
    </article>
  );
}
