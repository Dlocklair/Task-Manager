import { useStore } from "../lib/store";
import { dueLabel, formatTime, reminderMoment } from "../lib/util";
import type { Task } from "../lib/types";

/** "Remind me X days and Y hours before this is due." Stored as minutes before the due moment. */
export function ReminderField({ task }: { task: Task }) {
  const s = useStore();
  if (!task.due_date) return <p className="field-hint">Set a due date to add a reminder.</p>;

  const m = task.remind_before_minutes;
  const days = m === null ? 0 : Math.floor(m / 1440);
  const hours = m === null ? 0 : Math.floor((m % 1440) / 60);
  const set = (d: number, h: number) => s.updateTask(task.id, { remind_before_minutes: d * 1440 + Math.min(23, Math.max(0, h)) * 60 });
  const at = reminderMoment(task);

  return (
    <div className="reminder">
      <label className="check-line">
        <input type="checkbox" checked={m !== null} onChange={(e) => s.updateTask(task.id, { remind_before_minutes: e.target.checked ? 1440 : null })} />
        Remind me before it is due
      </label>
      {m !== null && (
        <>
          <div className="remind-inputs">
            <input type="number" min="0" inputMode="numeric" aria-label="Days before due" value={days} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0), hours)} />
            <span>days</span>
            <input type="number" min="0" max="23" inputMode="numeric" aria-label="Hours before due" value={hours} onChange={(e) => set(days, Number(e.target.value) || 0)} />
            <span>hours</span>
          </div>
          {at && (
            <p className="field-hint">
              Reminder on {dueLabel(localDay(at))} at {formatTime(`${pad(at.getHours())}:${pad(at.getMinutes())}`)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
