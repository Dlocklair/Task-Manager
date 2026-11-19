import { useEffect, useRef, useState } from "react";
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
  const [picking, setPicking] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Open the calendar straight away when "Pick date" is pressed.
  useEffect(() => {
    if (!picking) return;
    const el = input.current;
    el?.focus();
    try {
      el?.showPicker?.();
    } catch {
      /* some browsers only open the picker from a direct tap on the field */
    }
  }, [picking]);

  const choose = (v: string | null) => {
    setPicking(false);
    onChange(v);
  };

  return (
    <div className={"due-picker" + (dark ? " dark" : "")} role="group" aria-label={label}>
      <button type="button" className={"chip-btn" + (value === today ? " on" : "")} aria-pressed={value === today} onClick={() => choose(value === today && clearable ? null : today)}>Today</button>
      <button type="button" className={"chip-btn" + (value === tomorrow ? " on" : "")} aria-pressed={value === tomorrow} onClick={() => choose(value === tomorrow && clearable ? null : tomorrow)}>Tomorrow</button>
      {custom || picking ? (
        <input
          ref={input}
          type="date"
          className={custom ? "on" : ""}
          aria-label={label}
          value={custom ? value! : ""}
          onChange={(e) => e.target.value && choose(e.target.value)}
          onBlur={() => setPicking(false)}
        />
      ) : (
        <button type="button" className="chip-btn" onClick={() => setPicking(true)}>Pick date…</button>
      )}
      {clearable && value && (
        <button type="button" className="chip-clear" aria-label="Remove due date" title="Remove due date" onClick={() => choose(null)}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
