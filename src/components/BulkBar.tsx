import { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../lib/store";
import { CONTEXTS, PRIORITIES, STATUSES } from "../lib/util";
import type { Priority, Status, TaskContext } from "../lib/types";

/** Appears when tasks are selected. Each control applies to every selected task at once. */
export function BulkBar() {
  const s = useStore();
  const ids = [...s.selection].filter((id) => s.task(id));
  const [person, setPerson] = useState("");
  const [days, setDays] = useState("");
  const [hours, setHours] = useState("");
  if (ids.length === 0) return null;

  const withDue = ids.filter((id) => s.task(id)?.due_date);
  const confirmDelete = () => {
    const subs = ids.reduce((n, id) => n + s.kids(id).length, 0);
    const extra = subs ? ` and their ${subs} subtask${subs === 1 ? "" : "s"}` : "";
    if (window.confirm(`Delete ${ids.length} task${ids.length === 1 ? "" : "s"}${extra}? This can't be undone.`)) s.bulkDelete(ids);
  };
  const minutes = (Number(days) || 0) * 1440 + (Number(hours) || 0) * 60;
  const who = s.data.people.find((p) => p.id === person);

  return (
    <div className="bulk-dock" role="region" aria-label="Selected tasks">
      <div className="bulk-count">
        <strong>{ids.length} selected</strong>
        <button className="icon-btn on-dark" onClick={() => s.clearSelection()} aria-label="Clear selection"><X size={16} /></button>
      </div>

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

      <label className="bulk-field">
        <span>Due</span>
        <input type="date" value="" onChange={(e) => e.target.value && s.bulkUpdate(ids, { due_date: e.target.value })} />
      </label>
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

      <button className="btn small danger-solid" onClick={confirmDelete}>Delete</button>
    </div>
  );
}
