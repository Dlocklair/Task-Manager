import { useEffect, useState } from "react";
import { ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { useStore } from "../lib/store";
import { DuePicker } from "./DuePicker";
import { CONTEXTS, PRIORITIES, STATUSES } from "../lib/util";
import type { Priority, Status, TaskContext } from "../lib/types";

/**
 * Appears when tasks are selected. It starts as a slim bar so the list stays clear and you can keep picking
 * tasks. "Edit selected" opens the options; each one applies to every selected task at once.
 */
export function BulkBar() {
  const s = useStore();
  const ids = [...s.selection].filter((id) => s.task(id));
  const [person, setPerson] = useState("");
  const [days, setDays] = useState("");
  const [hours, setHours] = useState("");
  const [open, setOpen] = useState(false);
  const any = ids.length > 0;

  // Close the options when nothing is selected, and leave room under the list so the bar never hides a row.
  useEffect(() => {
    if (!any) setOpen(false);
    document.body.classList.toggle("has-bulk", any);
    return () => document.body.classList.remove("has-bulk");
  }, [any]);

  if (!any) return null;

  const withDue = ids.filter((id) => s.task(id)?.due_date);
  const confirmDelete = () => {
    const subs = ids.reduce((n, id) => n + s.kids(id).length, 0);
    const extra = subs ? ` and their ${subs} subtask${subs === 1 ? "" : "s"}` : "";
    if (window.confirm(`Delete ${ids.length} task${ids.length === 1 ? "" : "s"}${extra}? This can't be undone.`)) s.bulkDelete(ids);
  };
  const minutes = (Number(days) || 0) * 1440 + (Number(hours) || 0) * 60;
  const who = s.data.people.find((p) => p.id === person);

  return (
    <div className={"bulk-dock" + (open ? " is-open" : "")} role="region" aria-label="Selected tasks">
      <div className="bulk-count">
        <strong>{ids.length} selected</strong>
        <button className="btn small bulk-edit" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <><ChevronDown size={15} />Hide options</> : <><Pencil size={14} />Edit selected</>}
        </button>
        {!open && <button className="btn small danger-solid" onClick={confirmDelete}><Trash2 size={14} />Delete</button>}
        <button className="icon-btn on-dark" onClick={() => s.clearSelection()} aria-label="Clear selection"><X size={16} /></button>
      </div>

      {open && <div className="bulk-options">

      <label className="bulk-field">
        <span>Status</span>
        <select value="" onChange={(e) => e.target.value && s.bulkUpdate(ids, { status: e.target.value as Status })}>
          <option value="">Choose…</option>
          {STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
        </select>
      </label>

      <label className="bulk-field">
        <span>Priority</span>
        <select value="" onChange={(e) => e.target.value && s.bulkUpdate(ids, { priority: e.target.value as Priority })}>
          <option value="">Choose…</option>
          {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>

      <label className="bulk-field">
        <span>Context</span>
        <select value="" onChange={(e) => e.target.value && s.bulkUpdate(ids, { context: e.target.value as TaskContext })}>
          <option value="">Choose…</option>
          {CONTEXTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>

      <div className="bulk-field">
        <span>Due</span>
        <DuePicker dark clearable={false} value={null} label="Set due date for selected" onChange={(v) => v && s.bulkUpdate(ids, { due_date: v })} />
      </div>
      <button className="btn small" onClick={() => s.bulkUpdate(ids, { due_date: null })}>Clear due date</button>

      <label className="bulk-field">
        <span>Project</span>
        <select value="" onChange={(e) => e.target.value && s.bulkUpdate(ids, { project_id: e.target.value })}>
          <option value="">Move to…</option>
          {s.data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <div className="bulk-field wide">
        <span>Assigned to</span>
        <div className="bulk-inline">
          <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person">
            <option value="">Choose a person…</option>
            {s.data.people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <button className="btn small" disabled={!who} onClick={() => who && s.bulkAssign(ids, who.id, true)}>Assign</button>
          <button className="btn small" disabled={!who} onClick={() => who && s.bulkAssign(ids, who.id, false)}>Remove</button>
        </div>
      </div>

      <div className="bulk-field wide">
        <span>Remind me before due</span>
        <div className="bulk-inline">
          <input type="number" min="0" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Days before" placeholder="0" />
          <small>days</small>
          <input type="number" min="0" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours before" placeholder="0" />
          <small>hours</small>
          <button
            className="btn small"
            disabled={minutes <= 0 || withDue.length === 0}
            title={withDue.length === 0 ? "Only tasks with a due date can have a reminder" : undefined}
            onClick={() => s.bulkUpdate(withDue, { remind_before_minutes: minutes })}
          >
            Set reminder
          </button>
          <button className="btn small" onClick={() => s.bulkUpdate(ids, { remind_before_minutes: null })}>No reminder</button>
        </div>
        {withDue.length < ids.length && <small className="bulk-note">Only the {withDue.length} with a due date will get a reminder.</small>}
      </div>

      <button className="btn small danger-solid" onClick={confirmDelete}><Trash2 size={14} />Delete</button>
      </div>}
    </div>
  );
}
