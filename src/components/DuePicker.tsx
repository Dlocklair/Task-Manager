import { useRef } from "react";
import { X } from "lucide-react";
import { addDays, isoDay } from "../lib/util";

/**
 * Quick due date: one tap for Today or Tomorrow, or "Pick date" for the calendar.
 * `dark` styles it for the bulk-edit bar. `clearable` shows an × to remove the date.
 */
export function DuePicker({ value, onChange, dark = false, clearable = true, label = "Due date" }: { value: string | null; onChange(v: string | null): void; dark?: boolean; clearable?: boolean; label?: string }) {
  const today = isoDay();
  const tomorrow = addDays(1);
  const custom = !!value && value !== today && value !== tomorrow;
  const input = useRef<HTMLInputElement>(null);

  const choose = (v: string | null) => onChange(v);

  // The date field is always on the page. Before a date is picked it sits invisibly over the "Pick date…" chip,
  // so the tap lands on the field itself. iPad Safari only opens its calendar from a real tap on the field;
  // opening it from code made it flash up and close again.
  const openPicker = () => {
    try {
      input.current?.showPicker?.();
    } catch {
      /* the tap on the field opens it anyway */
    }
  };

  return (
    <div className={"due-picker" + (dark ? " dark" : "")} role="group" aria-label={label}>
      <button type="button" className={"chip-btn" + (value === today ? " on" : "")} aria-pressed={value === today} onClick={() => choose(value === today && clearable ? null : today)}>Today</button>
      <button type="button" className={"chip-btn" + (value === tomorrow ? " on" : "")} aria-pressed={value === tomorrow} onClick={() => choose(value === tomorrow && clearable ? null : tomorrow)}>Tomorrow</button>
      <span className={"due-pick" + (custom ? " has-date" : "")}>
        {!custom && <span className="chip-btn" aria-hidden="true">Pick date…</span>}
        <input
          ref={input}
          type="date"
          className={custom ? "on" : "due-pick-overlay"}
          aria-label={custom ? label : "Pick a date"}
          value={custom ? value! : ""}
          onClick={openPicker}
          onChange={(e) => e.target.value && choose(e.target.value)}
        />
      </span>
      {clearable && value && (
        <button type="button" className="chip-clear" aria-label="Remove due date" title="Remove due date" onClick={() => choose(null)}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
