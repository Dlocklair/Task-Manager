import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { ChevronRight, GripVertical, ListTree, Plus } from "lucide-react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { dragId, endDrag, placeBetween, startDrag, type ReorderScope } from "../lib/drag";
import { tint } from "../lib/util";
import { AvatarStack, Check, DueBadge, PriorityFlag } from "./ui";

export function TaskRow({ task, depth = 0, showProject = false, reorder }: { task: Task; depth?: number; showProject?: boolean; reorder?: ReorderScope }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edge, setEdge] = useState<"before" | "after" | null>(null);
  // Only the handle starts a drag, so tapping or scrolling on a tablet never moves a task by accident.
  const fromGrip = useRef(false);
  const kids = s.kids(task.id);
  const project = s.project(task.project_id);
  const done = task.status === "done";
  const doneKids = kids.filter((k) => k.status === "done").length;
  const picked = s.selection.has(task.id);
  // Rows only accept a task from their own group, so a drag can never jump to another group.
  const canDrop = (id: string | null) => !!reorder && !!id && id !== task.id && reorder.list.some((t) => t.id === id);

  return (
    <>
      <div
        className={"row" + (done ? " is-done" : "") + (s.selectedId === task.id ? " is-selected" : "") + (picked ? " is-picked" : "") + (edge ? ` drop-${edge}` : "")}
        style={{ ...tint(project?.color ?? "#5B6B86"), paddingLeft: 10 + depth * 28 }}
        draggable={!!reorder}
        onDragStart={(e) => {
          if (!reorder) return;
          if (!fromGrip.current) {
            e.preventDefault();
            return;
          }
          e.stopPropagation();
          startDrag(task.id);
          e.dataTransfer.setData("text/task", task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          fromGrip.current = false;
          endDrag();
        }}
        onDragOver={(e: DragEvent<HTMLDivElement>) => {
          if (!canDrop(dragId())) return;
          e.preventDefault();
          e.stopPropagation();
          const box = e.currentTarget.getBoundingClientRect();
          setEdge(e.clientY < box.top + box.height / 2 ? "before" : "after");
        }}
        onDragLeave={() => setEdge(null)}
        onDrop={(e) => {
          const id = dragId();
          setEdge(null);
          if (!reorder || !canDrop(id)) return;
          e.preventDefault();
          e.stopPropagation();
          const where = edge ?? "after";
          const dragged = s.task(id!);
          if (!dragged) return;
          // Only the order changes. The task keeps its priority and status wherever it is dropped.
          s.updateTask(dragged.id, { position: placeBetween(reorder.list, dragged.id, task, where) });
        }}
        // While selecting several tasks, a click ticks the row instead of opening the side panel over the list.
        onClick={() => (s.selecting ? s.toggleSelect(task.id) : s.openTask(task.id))}
        onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && (s.selecting ? s.toggleSelect(task.id) : s.openTask(task.id))}
        tabIndex={0}
      >
        {reorder && (
          <span
            className="grip"
            title="Drag to reorder"
            aria-hidden="true"
            onPointerDown={() => (fromGrip.current = true)}
            onPointerUp={() => (fromGrip.current = false)}
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
        <span className="row-title">{task.title}</span>
        <span className="row-meta">
          {showProject && project && <span className="proj-chip"><i />{project.name}</span>}
          {kids.length > 0 && <span className="sub-count"><ListTree size={13} />{doneKids}/{kids.length}</span>}
          <PriorityFlag priority={task.priority} />
          <DueBadge task={task} />
          <AvatarStack people={s.assigned(task.id)} />
        </span>
      </div>
      {open && kids.map((k) => <TaskRow key={k.id} task={k} depth={depth + 1} reorder={{ list: kids, mode: "manual" }} />)}
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
