import { useEffect, useRef, useState } from "react";
import { Check as CheckIcon, ChevronDown } from "lucide-react";
import { useStore } from "../lib/store";

/**
 * A dropdown for choosing several people at once. Each person is one line: a box and their name.
 * Ticking a box adds them to `value`; unticking removes them. The list stays open until you press Done or tap away.
 */
export function PeopleDropdown({ value, onChange, label, placeholder = "Choose people" }: { value: string[]; onChange(ids: string[]): void; label: string; placeholder?: string }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const people = [...s.data.people].sort((a, b) => a.full_name.localeCompare(b.full_name));
  const picked = people.filter((p) => value.includes(p.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes only the list, not the dialog it sits in.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary =
    picked.length === 0 ? null : picked.length <= 2 ? picked.map((p) => p.full_name).join(", ") : `${picked[0].full_name} and ${picked.length - 1} more`;

  return (
    <div className="picker people-dd" ref={root}>
      <button type="button" className="picker-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        {summary ? <span className="picker-summary">{summary}</span> : <span className="picker-empty">{placeholder}</span>}
        <ChevronDown size={18} className={open ? "turn" : ""} />
      </button>
      {open && (
        <div className="picker-panel" role="listbox" aria-multiselectable="true" aria-label={label}>
          <div className="picker-list">
            {people.map((p) => {
              const on = value.includes(p.id);
              return (
                <label key={p.id} className={"dd-row" + (on ? " on" : "")} role="option" aria-selected={on}>
                  <input type="checkbox" className="pick-box-input" checked={on} onChange={() => toggle(p.id)} />
                  <span className="pick-box" aria-hidden="true">{on && <CheckIcon size={14} strokeWidth={3.2} />}</span>
                  <span className="dd-name">{p.full_name}{p.user_id === s.data.userId && <em> (you)</em>}</span>
                </label>
              );
            })}
            {people.length === 0 && <p className="picker-none">Add people on the People screen first.</p>}
          </div>
          <div className="picker-foot">
            <span>{picked.length} selected</span>
            <span className="dd-foot-actions">
              {picked.length > 0 && <button type="button" className="btn small quiet" onClick={() => onChange([])}>Clear</button>}
              <button type="button" className="btn small" onClick={() => setOpen(false)}>Done</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
