import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { useStore } from "../lib/store";
import { downloadIcs, googleEvent, outlookEvent } from "../lib/calendar";
import type { Task } from "../lib/types";

/** Adds a copy of one task to a calendar. For every dated task to stay in step, use a calendar feed in Settings. */
export function AddToCalendar({ task }: { task: Task }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const project = s.project(task.project_id)?.name ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
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

  if (!task.due_date) return null;
  const link = (href: string, label: string) => (
    <a className="menu-item" href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>{label}</a>
  );

  return (
    <div className="cal-add" ref={root}>
      <button type="button" className="chip-btn cal-add-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <CalendarPlus size={14} />Add to calendar<ChevronDown size={13} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {link(googleEvent(task, project), "Google Calendar")}
          {link(outlookEvent(task, project, false), "Outlook.com")}
          {link(outlookEvent(task, project, true), "Outlook (work or school)")}
          <button type="button" className="menu-item" onClick={() => { downloadIcs(task, project); setOpen(false); }}>Apple Calendar or other (.ics file)</button>
          <p className="menu-note">Adds a one-time copy. To keep every dated task in your calendar, use Settings → Calendars.</p>
        </div>
      )}
    </div>
  );
}
