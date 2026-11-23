import { useState, type FormEvent } from "react";
import { ChevronRight, CornerDownRight, GripVertical, ListTree, Plus } from "lucide-react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { beginDrag, kidsScope, type ReorderScope } from "../lib/drag";
import { dragSpecFor } from "../lib/moves";
import { tint } from "../lib/util";
import { AvatarStack, Check, DueBadge, PriorityFlag } from "./ui";

export function TaskRow({ task, depth = 0, showProject = false, showPath = false, reorder }: { task: Task; depth?: number; showProject?: boolean; showPath?: boolean; reorder?: ReorderScope }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const kids = s.kids(task.id);
  const project = s.project(task.project_id);
  const done = task.status === "done";
  const doneKids = kids.filter((k) => k.status === "done").length;
  const picked = s.selection.has(task.id);
  // Search results show where a subtask sits, since it appears without the task above it.
  const path = showPath && task.parent_task_id ? s.ancestors(task.id) : [];

  return (
    <>
      <div
        className={"row" + (done ? " is-done" : "") + (s.selectedId === task.id ? " is-selected" : "") + (picked ? " is-picked" : "") + (path.length ? " has-path" : "")}
        style={{ ...tint(project?.color ?? "#5B6B86"), paddingLeft: 10 + depth * 28 }}
        data-drop-id={task.id}
        data-drop-scope={reorder?.key}
        // While selecting several tasks, a click ticks the row instead of opening the side panel over the list.
        onClick={() => (s.selecting ? s.toggleSelect(task.id) : s.openTask(task.id))}
        onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && (s.selecting ? s.toggleSelect(task.id) : s.openTask(task.id))}
        tabIndex={0}
      >
        {(reorder || task.parent_task_id) && (
          <span
            className="grip"
            title={task.parent_task_id ? "Drag to reorder, or onto another task to move it there" : "Drag to reorder"}
            aria-hidden="true"
            onPointerDown={(e) => beginDrag(e, dragSpecFor(s, task, reorder))}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={16} />
          </span>
        )}
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
        <span className="row-title">
          {path.length > 0 && <span className="row-path"><CornerDownRight size={12} />{path.map((a) => a.title).join(" › ")}</span>}
          {task.title}
        </span>
        <span className="row-meta">
          {showProject && project && <span className="proj-chip"><i />{project.name}</span>}
          {kids.length > 0 && <span className="sub-count"><ListTree size={13} />{doneKids}/{kids.length}</span>}
          <PriorityFlag priority={task.priority} />
          <DueBadge task={task} />
          <AvatarStack people={s.assigned(task.id)} />
        </span>
      </div>
      {open && kids.map((k) => <TaskRow key={k.id} task={k} depth={depth + 1} reorder={{ key: kidsScope(task.id), list: kids }} />)}
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
