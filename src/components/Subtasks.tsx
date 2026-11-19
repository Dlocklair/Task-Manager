import { useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, GripVertical } from "lucide-react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { dragId, endDrag, placeBetween, startDrag } from "../lib/drag";
import { AvatarStack, Check, DueBadge, PriorityFlag } from "./ui";
import { RichField } from "./RichText";
import { TaskFields } from "./TaskFields";

/**
 * A task's subtasks. Each shows one tidy line: tick box, name, and the key facts that are set.
 * The arrow opens that subtask to edit every field a task has. Drag the grip to put them in any order.
 */
export function Subtasks({ kids }: { kids: Task[] }) {
  return (
    <div className="subtasks">
      {kids.map((k, i) => <SubtaskItem key={k.id} task={k} siblings={kids} index={i} />)}
    </div>
  );
}

function SubtaskItem({ task, siblings, index }: { task: Task; siblings: Task[]; index: number }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [edge, setEdge] = useState<"before" | "after" | null>(null);
  const done = task.status === "done";
  const canDrop = (id: string | null) => !!id && id !== task.id && siblings.some((t) => t.id === id);

  const moveTo = (target: Task, where: "before" | "after") => s.updateTask(task.id, { position: placeBetween(siblings, task.id, target, where) });

  return (
    <div className={"subtask" + (done ? " is-done" : "") + (open ? " is-open" : "") + (edge ? ` drop-${edge}` : "")}>
      <div
        className="subtask-head"
        draggable
        onDragStart={(e) => {
          startDrag(task.id);
          e.dataTransfer.setData("text/task", task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={endDrag}
        onDragOver={(e: DragEvent<HTMLDivElement>) => {
          if (!canDrop(dragId())) return;
          e.preventDefault();
          const box = e.currentTarget.getBoundingClientRect();
          setEdge(e.clientY < box.top + box.height / 2 ? "before" : "after");
        }}
        onDragLeave={() => setEdge(null)}
        onDrop={(e) => {
          const id = dragId();
          const where = edge ?? "after";
          setEdge(null);
          if (!canDrop(id)) return;
          e.preventDefault();
          const dragged = s.task(id!);
          if (dragged) s.updateTask(dragged.id, { position: placeBetween(siblings, dragged.id, task, where) });
        }}
      >
        <span className="grip" title="Drag to reorder" aria-hidden="true"><GripVertical size={16} /></span>
        <Check done={done} label={task.title} onToggle={() => s.updateTask(task.id, { status: done ? "todo" : "done" })} />
        <button className="subtask-title" aria-expanded={open} onClick={() => setOpen(!open)}>{task.title}</button>
        <span className="subtask-meta">
          <PriorityFlag priority={task.priority} />
          <DueBadge task={task} />
          <AvatarStack people={s.assigned(task.id)} />
        </span>
        <button
          className={"caret" + (open ? " open" : "")}
          aria-expanded={open}
          aria-label={open ? `Hide details for ${task.title}` : `Show details for ${task.title}`}
          onClick={() => setOpen(!open)}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {open && (
        <div className="subtask-more">
          <TaskFields task={task} compact />
          <div className="subtask-details">
            <span>Details</span>
            <RichField value={task.description ?? ""} label="details" placeholder="Add details, bullets or steps" onSave={(v) => s.updateTask(task.id, { description: v })} />
          </div>
          <div className="subtask-actions">
            {/* Up and down buttons do what dragging does, for touch screens and keyboards. */}
            <button className="btn small" disabled={index === 0} onClick={() => moveTo(siblings[index - 1], "before")}><ArrowUp size={14} />Move up</button>
            <button className="btn small" disabled={index === siblings.length - 1} onClick={() => moveTo(siblings[index + 1], "after")}><ArrowDown size={14} />Move down</button>
            <span className="grow" />
            <button className="btn small" onClick={() => s.openTask(task.id)}><ExternalLink size={14} />Open as a task</button>
          </div>
        </div>
      )}
    </div>
  );
}
