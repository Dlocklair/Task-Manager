import { useStore } from "../lib/store";
import type { Priority, Task, TaskContext } from "../lib/types";
import { CONTEXTS, PRIORITIES, STATUSES, step } from "../lib/util";
import { AssigneePicker } from "./AssigneePicker";
import { DuePicker } from "./DuePicker";
import { ReminderField } from "./ReminderField";
import { DueBadge } from "./ui";

/**
 * Every editable field of a task, in three shaded groups so related settings sit together:
 *  - When: due date, time and reminder
 *  - Priority and context
 *  - Project and people
 * Status sits on its own line above them because it changes most often.
 * The task panel and an expanded subtask share this. `compact` is for a subtask: status is a dropdown
 * and the project is left out, because a subtask always belongs to its parent's project.
 */
export function TaskFields({ task, compact = false }: { task: Task; compact?: boolean }) {
  const s = useStore();
  const current = step(task.status);
  const id = (name: string) => `f-${name}-${task.id}`;

  return (
    <div className={"task-fields" + (compact ? " compact" : "")}>
      <div className="status-line">
        {compact ? (
          <>
            <label htmlFor={id("status")}>Status</label>
            <select id={id("status")} value={current} onChange={(e) => s.updateTask(task.id, { status: e.target.value as Task["status"] })}>
              {STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
            </select>
          </>
        ) : (
          <div className="seg status" role="radiogroup" aria-label="Status">
            {STATUSES.map((st) => (
              <button key={st.id} role="radio" aria-checked={current === st.id} className={(current === st.id ? "on " : "") + st.id} onClick={() => s.updateTask(task.id, { status: st.id })}>
                {st.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="field-card" aria-label="When">
        <h4>When {!compact && task.due_date && <DueBadge task={task} />}</h4>
        <div className="field-line">
          <span className="field-label">Due</span>
          <div className="field-row">
            <DuePicker value={task.due_date} onChange={(v) => s.updateTask(task.id, { due_date: v })} />
            {task.due_date && (
              <input
                type="time"
                className="due-time"
                aria-label="Due time"
                title="Due time. Leave blank for 9:00 AM."
                value={task.due_time?.slice(0, 5) ?? ""}
                onChange={(e) => s.updateTask(task.id, { due_time: e.target.value || null })}
              />
            )}
          </div>
        </div>
        <div className="field-line">
          <span className="field-label">Remind</span>
          <ReminderField task={task} />
        </div>
      </section>

      <section className="field-card" aria-label="Priority and context">
        <h4>Priority &amp; context</h4>
        <div className="field-pair">
          <label>
            <span className="field-label">Priority</span>
            <select value={task.priority} onChange={(e) => s.updateTask(task.id, { priority: e.target.value as Priority })}>
              {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Context</span>
            <select value={task.context ?? ""} onChange={(e) => s.updateTask(task.id, { context: (e.target.value || null) as TaskContext | null })}>
              <option value="">No context</option>
              {CONTEXTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="field-card" aria-label={compact ? "People" : "Project and people"}>
        <h4>{compact ? "People" : <>Project &amp; people</>}</h4>
        {!compact && (
          <div className="field-line">
            <label className="field-label" htmlFor={id("proj")}>Project</label>
            <select id={id("proj")} value={task.project_id} onChange={(e) => s.updateTask(task.id, { project_id: e.target.value })}>
              {s.data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="field-line">
          <span className="field-label">Assigned</span>
          <AssigneePicker taskId={task.id} />
        </div>
      </section>
    </div>
  );
}
