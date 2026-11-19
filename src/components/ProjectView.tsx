import { useState } from "react";
import { Columns3, LayoutList, Mail, Pencil } from "lucide-react";
import { useStore } from "../lib/store";
import { applyFilters, DEFAULT_CONFIG, groupTasks, NO_SEARCH, reorderMode, type TextSearch } from "../lib/listing";
import type { GroupKey, ListConfig, Project, Task } from "../lib/types";
import { sortCompare, STATUSES, step, tint } from "../lib/util";
import { QuickAdd } from "./TaskList";
import { mailtoLink } from "../lib/mail";
import { ListTools } from "./ListTools";
import { TopActions } from "./TopActions";
import { TaskSections } from "./TaskSections";
import { AvatarStack, Check, DueBadge, Empty, PriorityFlag } from "./ui";

type Step = "todo" | "in_progress" | "done";

/** Groupings that make sense inside one project. Board view is always by status. */
const PROJECT_GROUPS: GroupKey[] = ["status", "assigned", "priority", "due", "none"];

export function ProjectView({ project, onEdit }: { project: Project; onEdit(): void }) {
  const s = useStore();
  const [mode, setMode] = useState<"list" | "board">("list");
  const [cfg, setCfg] = useState<ListConfig>(DEFAULT_CONFIG);
  const [search, setSearch] = useState<TextSearch>(NO_SEARCH);
  const allTasks = s.topLevel(project.id);
  const ctx = { people: s.data.people, projects: s.data.projects, assigned: (id: string) => s.assigned(id) };
  // Filtering is by the task's own assignees. Subtasks are not filtered separately.
  const tasks = applyFilters(allTasks, cfg, ctx, search);
  const prog = s.progress(project.id);

  const board: Record<Step, Task[]> = { in_progress: [], todo: [], done: [] };
  for (const t of tasks) board[step(t.status)].push(t);
  const cmp = sortCompare(cfg.sortBy, (id) => s.assigned(id)[0]?.full_name ?? "");
  board.todo.sort(cmp);
  board.in_progress.sort(cmp);
  if (cfg.sortBy === "due") board.done.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  else board.done.sort(cmp);

  const sections = mode === "list" ? groupTasks(tasks, cfg, ctx) : [];

  return (
    <div className="page" style={tint(project.color)}>
      <div className="top-row">
        <TopActions />
      </div>
      <header className="banner">
        <div className="banner-top">
          <h1>{project.name}</h1>
          <div className="banner-actions">
            {(() => {
              const open = allTasks.filter((t) => t.status !== "done");
              const people = new Map<string, { name: string; email: string | null }>();
              open.forEach((t) => s.assigned(t.id).forEach((p) => people.set(p.id, { name: p.full_name, email: p.email })));
              const to = [...people.values()].map((p) => p.email).filter((e): e is string => !!e);
              if (to.length === 0) return <button className="icon-btn on-color" disabled aria-label="Email assignees" title="Assign people with an email address to email them"><Mail size={17} /></button>;
              const lines = open.map((t) => {
                const names = s.assigned(t.id).map((p) => p.full_name).join(", ");
                return `- ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}${names ? ` — ${names}` : ""}`;
              });
              return (
                <a className="icon-btn on-color" href={mailtoLink(to, `Open tasks: ${project.name}`, [`Open tasks in ${project.name}:`, "", ...lines])} aria-label="Email assignees" title="Email assignees">
                  <Mail size={17} />
                </a>
              );
            })()}
            <button className="icon-btn on-color" onClick={onEdit} aria-label="Edit project"><Pencil size={17} /></button>
          </div>
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
        <ListTools
          scope={project.id}
          cfg={cfg}
          base={DEFAULT_CONFIG}
          onChange={setCfg}
          search={search}
          onSearch={setSearch}
          groups={mode === "list" ? PROJECT_GROUPS : []}
          showProject={false}
          shown={tasks.length}
          total={allTasks.length}
        />
      )}

      {allTasks.length === 0 ? (
        <Empty title="This project has no tasks yet">Type the first one in the box above and press Enter.</Empty>
      ) : tasks.length === 0 ? (
        <Empty title="No tasks match">Clear the search or filters above to see more.</Empty>
      ) : mode === "list" ? (
        <TaskSections sections={sections} groupBy={cfg.groupBy} openDone={search.includeClosed && search.q.trim().length > 0} reorderable={reorderMode(cfg.sortBy)} />
      ) : (
        <Board groups={board} projectId={project.id} />
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
      onClick={() => (s.selecting ? s.toggleSelect(task.id) : s.openTask(task.id))}
      onKeyDown={(e) => e.key === "Enter" && (s.selecting ? s.toggleSelect(task.id) : s.openTask(task.id))}
      tabIndex={0}
    >
      <div className="card-top">
        {s.selecting && (
          <input
            type="checkbox"
            className="pick-tick"
            checked={picked}
            aria-label={`Select ${task.title}`}
            onClick={(e) => e.stopPropagation()}
            onChange={() => s.toggleSelect(task.id)}
          />
        )}
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
