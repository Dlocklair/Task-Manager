import { useEffect } from "react";
import { ArrowLeft, CornerDownRight, CornerLeftUp, Trash2, X } from "lucide-react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { step, tint } from "../lib/util";
import { RichField } from "./RichText";
import { Notes } from "./Notes";
import { QuickAdd } from "./TaskList";
import { Check } from "./ui";
import { Subtasks } from "./Subtasks";
import { TaskFields } from "./TaskFields";

export function TaskDetail({ task }: { task: Task }) {
  const s = useStore();
  const project = s.project(task.project_id);
  const parent = task.parent_task_id ? s.task(task.parent_task_id) : undefined;
  const kids = s.kids(task.id);
  const doneKids = kids.filter((k) => k.status === "done").length;
  const current = step(task.status);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && s.openTask(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s]);

  return (
    <aside className="detail" style={tint(project?.color ?? "#5B6B86")} aria-label="Task details">
      <header className="detail-head">
        <button className="icon-btn back" onClick={() => s.openTask(null)} aria-label="Back"><ArrowLeft size={20} /></button>
        <span className={"proj-chip" + (project ? "" : " none")}><i />{project?.name ?? "No project"}</span>
        <span className="grow" />
        <button
          className="icon-btn danger"
          aria-label="Delete task"
          onClick={() => {
            const extra = kids.length ? ` and its ${kids.length} subtask${kids.length > 1 ? "s" : ""}` : "";
            if (window.confirm(`Delete "${task.title}"${extra}? This can't be undone.`)) s.deleteTask(task.id);
          }}
        >
          <Trash2 size={18} />
        </button>
        <button className="icon-btn close" onClick={() => s.openTask(null)} aria-label="Close"><X size={20} /></button>
      </header>

      <div className="detail-body" key={task.id}>
        {parent && <Lineage task={task} />}
        <div className="detail-title">
          <Check done={current === "done"} label={task.title} onToggle={() => s.updateTask(task.id, { status: current === "done" ? "todo" : "done" })} />
          <textarea
            className="title-input"
            rows={1}
            defaultValue={task.title}
            aria-label="Task name"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== task.title) s.updateTask(task.id, { title: v });
              else e.target.value = task.title;
            }}
          />
        </div>

        <TaskFields task={task} />

        <section className="detail-section">
          <h3>Details</h3>
          <RichField
            value={task.description ?? ""}
            label="details"
            placeholder="Add details, bullets or steps"
            onSave={(v) => s.updateTask(task.id, { description: v })}
          />
        </section>

        <Notes taskId={task.id} />

        <section className="detail-section">
          <h3>Subtasks{kids.length > 0 && <span className="count">{doneKids} of {kids.length} done</span>}</h3>
          {kids.length > 0 && <div className="bar thin"><span style={{ width: `${(100 * doneKids) / kids.length}%` }} /></div>}
          <Subtasks parentId={task.id} kids={kids} />
          <QuickAdd placeholder="Add a subtask" onAdd={(title) => s.addTask({ project_id: task.project_id, parent_task_id: task.id, title })} />
        </section>
      </div>
    </aside>
  );
}


/**
 * Where a subtask sits: every task above it, from the top-level task down, each a step further in.
 * Tap any of them to open it.
 */
function Lineage({ task }: { task: Task }) {
  const s = useStore();
  const above = s.ancestors(task.id);
  if (!above.length) return null;
  return (
    <nav className="lineage" aria-label="Tasks this subtask sits under">
      <span className="lineage-label"><CornerLeftUp size={13} />Subtask of</span>
      <ol>
        {above.map((a, i) => (
          <li key={a.id} style={{ paddingLeft: i * 18 }}>
            {i > 0 && <CornerDownRight size={13} aria-hidden="true" />}
            <button onClick={() => s.openTask(a.id)} title={`Open ${a.title}`}>{a.title}</button>
          </li>
        ))}
        <li className="here" style={{ paddingLeft: above.length * 18 }} aria-current="true">
          <CornerDownRight size={13} aria-hidden="true" />
          <span>{task.title}</span>
        </li>
      </ol>
    </nav>
  );
}
