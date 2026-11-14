import { useState, type FormEvent } from "react";
import { ChevronRight, ListTree, Plus } from "lucide-react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { tint } from "../lib/util";
import { AvatarStack, Check, DueBadge, PriorityFlag } from "./ui";

export function TaskRow({ task, depth = 0, showProject = false }: { task: Task; depth?: number; showProject?: boolean }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const kids = s.kids(task.id);
  const project = s.project(task.project_id);
  const done = task.status === "done";
  const doneKids = kids.filter((k) => k.status === "done").length;

  return (
    <>
      <div
        className={"row" + (done ? " is-done" : "") + (s.selectedId === task.id ? " is-selected" : "")}
        style={{ ...tint(project?.color ?? "#5B6B86"), paddingLeft: 10 + depth * 28 }}
        onClick={() => s.openTask(task.id)}
        onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && s.openTask(task.id)}
        tabIndex={0}
      >
        {kids.length > 0 ? (
          <button
            className={"caret" + (open ? " open" : "")}
            aria-expanded={open}
            aria-label={open ? "Hide subtasks" : "Show subtasks"}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            <ChevronRight size={16} />
          </button>
        ) : (
          <span className="caret-space" />
        )}
        <Check done={done} label={task.title} onToggle={() => s.updateTask(task.id, { status: done ? "todo" : "done" })} />
        <span className="row-title">{task.title}</span>
        <span className="row-meta">
          {showProject && project && <span className="proj-chip"><i />{project.name}</span>}
          {kids.length > 0 && <span className="sub-count"><ListTree size={13} />{doneKids}/{kids.length}</span>}
          <PriorityFlag priority={task.priority} />
          <DueBadge task={task} />
          <AvatarStack people={s.assigned(task.id)} />
        </span>
      </div>
      {open && kids.map((k) => <TaskRow key={k.id} task={k} depth={depth + 1} />)}
    </>
  );
}

export function QuickAdd({ placeholder, onAdd }: { placeholder: string; onAdd(title: string): void }) {
  const [title, setTitle] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle("");
  };
  return (
    <form className="quick-add" onSubmit={submit}>
      <Plus size={17} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {title.trim() && <button className="btn primary small" type="submit">Add</button>}
    </form>
  );
}
