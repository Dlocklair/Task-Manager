import { ListChecks, MessageSquareText } from "lucide-react";
import type { Project, Task } from "../types";
import { statusDef } from "../constants";
import { Avatar, DueBadge, PriorityLabel, ProjectPill } from "./bits";

interface Props {
  task: Task;
  project?: Project;
  selected: boolean;
  showProject: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  dragging: boolean;
}

export function TaskCard({ task, project, selected, showProject, onSelect, onDragStart, onDragEnd, dragging }: Props) {
  const done = task.subtasks.filter((s) => s.done).length;
  const total = task.subtasks.length;
  const s = statusDef(task.status);
  return (
    <button
      type="button"
      className={"card" + (selected ? " selected" : "") + (dragging ? " dragging" : "")}
      aria-pressed={selected}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-testid="task-card"
    >
      <span className="card-top">
        {showProject ? <ProjectPill project={project} /> : <span />}
        <PriorityLabel priority={task.priority} />
      </span>
      <span className={"card-title" + (task.status === "done" ? " done" : "")}>{task.title}</span>
      {total > 0 && (
        <span className="mini-progress" aria-label={`${done} of ${total} subtasks done`}>
          <span className="track"><span className="fill" style={{ display: "block", width: `${(done / total) * 100}%`, background: s.text }} /></span>
          <span className="meta" style={{ fontSize: 11 }}>{done}/{total}</span>
        </span>
      )}
      <span className="card-foot">
        <DueBadge task={task} />
        <span className="card-icons">
          {total > 0 && (
            <span className="icon-count" title={`${total} subtasks`}>
              <ListChecks size={13} aria-hidden="true" />{total}
            </span>
          )}
          {task.notes.length > 0 && (
            <span className="icon-count" title={`${task.notes.length} notes`}>
              <MessageSquareText size={13} aria-hidden="true" />{task.notes.length}
            </span>
          )}
          <Avatar name={task.owner} />
        </span>
      </span>
    </button>
  );
}
