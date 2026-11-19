import { useStore } from "../lib/store";
import type { Priority, Task, TaskContext } from "../lib/types";
import { CONTEXTS, PRIORITIES, STATUSES, step } from "../lib/util";
import { AssigneePicker } from "./AssigneePicker";
import { ReminderField } from "./ReminderField";
import { DueBadge } from "./ui";

/**
 * Every editable field of a task: status, due date and time, reminder, priority, context, assignees.
 * The task panel and an expanded subtask use this same set, so a subtask can hold everything a task can.
 * `compact` is for a subtask: status is a dropdown, and the project is left out because a subtask
 * always belongs to its parent's project.
 */
export function TaskFields({ task, compact = false }: { task: Task; compact?: boolean }) {
  const s = useStore();
  const current = step(task.status);
  const id = (name: string) => `f-${name}-${task.id}`;

  return (
    <div className="fields">
      <label htmlFor={compact ? id("status") : undefined}>Status</label>
      {compact ? (
        <select id={id("status")} value={current} onChange={(e) => s.updateTask(task.id, { status: e.target.value as Task["status"] })}>
          {STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
        </select>
      ) : (
        <div className="seg status" role="radiogroup" aria-label="Status">
          {STATUSES.map((st) => (
            <button key={st.id} role="radio" aria-checked={current === st.id} className={(current === st.id ? "on " : "") + st.id} onClick={() => s.updateTask(task.id, { status: st.id })}>
              {st.label}
            </button>
          ))}
        </div>
      )}

      <label htmlFor={id("due")}>Due</label>
      <div className="field-row">
        <input id={id("due")} type="date" value={task.due_date ?? ""} onChange={(e) => s.updateTask(task.id, { due_date: e.target.value || null })} />
        {task.due_date && (
          <input
            type="time"
            aria-label="Due time"
            title="Due time. Leave blank for 9:00 AM."
            value={task.due_time?.slice(0, 5) ?? ""}
            onChange={(e) => s.updateTask(task.id, { due_time: e.target.value || null })}
          />
        )}
        {!compact && <DueBadge task={task} />}
      </div>

      <label>Remind me</label>
      <ReminderField task={task} />

      <label htmlFor={id("prio")}>Priority</label>
      <select id={id("prio")} value={task.priority} onChange={(e) => s.updateTask(task.id, { priority: e.target.value as Priority })}>
        {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>

      <label htmlFor={id("ctx")}>Context</label>
      <select id={id("ctx")} value={task.context ?? ""} onChange={(e) => s.updateTask(task.id, { context: (e.target.value || null) as TaskContext | null })}>
        <option value="">No context</option>
        {CONTEXTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      {!compact && (
        <>
          <label htmlFor={id("proj")}>Project</label>
          <select id={id("proj")} value={task.project_id} onChange={(e) => s.updateTask(task.id, { project_id: e.target.value })}>
            {s.data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </>
      )}

      <label>Assigned to</label>
      <AssigneePicker taskId={task.id} />
    </div>
  );
}
