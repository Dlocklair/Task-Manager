import { useEffect, useMemo, useRef, useState } from "react";
import { Check as CheckIcon, ChevronDown, Search, X } from "lucide-react";
import { useStore } from "../lib/store";
import { firstName } from "../lib/util";
import { Avatar } from "./ui";

/** Dropdown with a checkbox per person. Checking assigns, unchecking removes. */
export function AssigneePicker({ taskId }: { taskId: string }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const assigned = s.assigned(taskId);
  const assignedIds = new Set(assigned.map((p) => p.id));

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...s.data.people].sort((a, b) => a.full_name.localeCompare(b.full_name));
    return q ? list.filter((p) => p.full_name.toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q)) : list;
  }, [s.data.people, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes only the dropdown, not the task panel behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="picker" ref={root}>
      <button
        type="button"
        className="picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {assigned.length === 0 ? (
          <span className="picker-empty">Assign people</span>
        ) : (
          <span className="picker-summary">
            {assigned.length === 1 ? assigned[0].full_name : `${assigned.length} people assigned`}
          </span>
        )}
        <ChevronDown size={18} className={open ? "turn" : ""} />
      </button>

      {assigned.length > 0 && (
        <div className="picker-chips">
          {assigned.map((p) => (
            <span key={p.id} className="person-chip on">
              <Avatar person={p} size={20} />
              {firstName(p.full_name)}
              <button
                type="button"
                className="chip-x"
                aria-label={`Remove ${p.full_name} from this task`}
                onClick={() => s.toggleAssignee(taskId, p.id)}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="picker-panel" role="listbox" aria-multiselectable="true" aria-label="People">
          {s.data.people.length > 6 && (
            <label className="picker-search">
              <Search size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" aria-label="Search people" autoFocus />
            </label>
          )}
          <div className="picker-list">
            {people.map((p) => {
              const on = assignedIds.has(p.id);
              return (
                <label key={p.id} className={"picker-row" + (on ? " on" : "")} role="option" aria-selected={on}>
                  <input
                    type="checkbox"
                    className="pick-box-input"
                    checked={on}
                    onChange={() => s.toggleAssignee(taskId, p.id)}
                  />
                  <span className="pick-box" aria-hidden="true">{on && <CheckIcon size={14} strokeWidth={3.2} />}</span>
                  <Avatar person={p} size={24} />
                  <span className="picker-name">
                    {p.full_name}
                    {p.user_id === s.data.userId && <em>You</em>}
                    {p.email && <small>{p.email}</small>}
                  </span>
                </label>
              );
            })}
            {people.length === 0 && <p className="picker-none">No one matches "{query.trim()}".</p>}
          </div>
          <div className="picker-foot">
            <span>{assigned.length} selected</span>
            <button type="button" className="btn small" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
