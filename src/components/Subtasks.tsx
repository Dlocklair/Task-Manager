import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, FolderInput, GripVertical, Trash2 } from "lucide-react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { beginDrag, kidsScope, placeBetween, type ReorderScope } from "../lib/drag";
import { dragSpecFor } from "../lib/moves";
import { AvatarStack, Check, DueBadge, PriorityFlag } from "./ui";
import { RichField } from "./RichText";
import { TaskFields } from "./TaskFields";
import { Notes } from "./Notes";
import { ParentPicker } from "./ParentPicker";
import { firstLine, Fold } from "./Fold";

/**
 * A task's subtasks. Each shows one tidy line: tick box, name, and the key facts that are set.
 * The arrow opens that subtask to edit every field a task has, plus its own notes.
 * Drag the grip to put them in any order (the order is saved), or onto another task in the list to move it there.
 * The bin deletes just that subtask (and anything under it), leaving the parent and the other subtasks alone.
 */
export function Subtasks({ parentId, kids }: { parentId: string; kids: Task[] }) {
  const scope: ReorderScope = { key: kidsScope(parentId), list: kids };
  return (
    <div className="subtasks">
      {kids.map((k, i) => <SubtaskItem key={k.id} task={k} scope={scope} index={i} />)}
    </div>
  );
}

function SubtaskItem({ task, scope, index }: { task: Task; scope: ReorderScope; index: number }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const siblings = scope.list;
  const done = task.status === "done";

  const remove = () => {
    const below = s.kids(task.id).length;
    const extra = below ? ` and the ${below} subtask${below > 1 ? "s" : ""} under it` : "";
    if (!window.confirm(`Delete the subtask "${task.title}"${extra}? This can't be undone.`)) return;
    s.deleteTask(task.id);
    s.toast(`Subtask "${task.title}" deleted.`);
  };

  const moveTo = (target: Task, where: "before" | "after") => s.updateTask(task.id, { position: placeBetween(siblings, task.id, target, where) });

  return (
    <div className={"subtask" + (done ? " is-done" : "") + (open ? " is-open" : "")}>
      <div className="subtask-head" data-drop-id={task.id} data-drop-scope={scope.key}>
        <span
          className="grip"
          title="Drag to reorder, or onto another task to move it there"
          aria-hidden="true"
          onPointerDown={(e) => beginDrag(e, dragSpecFor(s, task, scope))}
        >
          <GripVertical size={16} />
        </span>
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
        <button className="sub-del" aria-label={`Delete subtask ${task.title}`} title="Delete this subtask" onClick={remove}>
          <Trash2 size={15} />
        </button>
      </div>

      {open && (
        <div className="subtask-more">
          <TaskFields task={task} compact />
          <Fold title="Details" preview={firstLine(task.description)} empty="Nothing added yet" compact>
            {(byClick) => (
              <RichField value={task.description ?? ""} label="details" placeholder="Add details, bullets or steps" startEditing={byClick} onSave={(v) => s.updateTask(task.id, { description: v })} />
            )}
          </Fold>
          <Notes taskId={task.id} compact />
          <div className="subtask-actions">
            {/* Up and down buttons do what dragging does, for keyboards and small screens. */}
            <button className="btn small" disabled={index === 0} onClick={() => moveTo(siblings[index - 1], "before")}><ArrowUp size={14} />Move up</button>
            <button className="btn small" disabled={index === siblings.length - 1} onClick={() => moveTo(siblings[index + 1], "after")}><ArrowDown size={14} />Move down</button>
            <button className="btn small" onClick={() => setPicking(true)}><FolderInput size={14} />Move to another task</button>
            <span className="grow" />
            <button className="btn small" onClick={() => s.openTask(task.id)}><ExternalLink size={14} />Open as a task</button>
            <button className="btn small danger" onClick={remove}><Trash2 size={14} />Delete subtask</button>
          </div>
        </div>
      )}
      {picking && (
        <ParentPicker
          ids={[task.id]}
          title={`Move "${task.title}" to…`}
          onClose={() => setPicking(false)}
          onPick={(parentId) => {
            setPicking(false);
            const kids = s.kids(parentId).filter((k) => k.id !== task.id);
            s.moveTask(task.id, parentId, kids.length ? kids[kids.length - 1].position + 1000 : Date.now());
            const parent = s.task(parentId);
            if (parent) s.toast(`"${task.title}" moved to "${parent.title}".`);
          }}
        />
      )}
    </div>
  );
}
