import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CornerLeftUp, Trash2, X } from "lucide-react";
import { useStore } from "../lib/store";
import type { Note, Priority, Task } from "../lib/types";
import { PRIORITIES, STATUSES, step, tint, uid } from "../lib/util";
import { QuickAdd } from "./TaskList";
import { Avatar, Check, DueBadge } from "./ui";

export function TaskDetail({ task }: { task: Task }) {
  const s = useStore();
  const project = s.project(task.project_id);
  const parent = task.parent_task_id ? s.task(task.parent_task_id) : undefined;
  const kids = s.kids(task.id);
  const doneKids = kids.filter((k) => k.status === "done").length;
  const assigned = new Set(s.assigned(task.id).map((p) => p.id));
  const current = step(task.status);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && s.openTask(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s]);

  return (
    <aside className="detail" style={tint(project?.color ?? "#5B6B86")} aria-label="Task details">
      <header className="detail-head">
        <button className="icon-btn back" onClick={() => s.openTask(null)} aria-label="Back"><ArrowLeft size={20} /></button>
        <span className="proj-chip"><i />{project?.name}</span>
        <span className="grow" />
        <button
          className="icon-btn danger"
          aria-label="Delete task"
          onClick={() => {
            const extra = kids.length ? ` and its ${kids.length} subtask${kids.length > 1 ? "s" : ""}` : "";
            if (window.confirm(`Delete "${task.title}"${extra}? This can't be undone.`)) s.deleteTask(task.id);
          }}
        >
          <Trash2 size={18} />
        </button>
        <button className="icon-btn close" onClick={() => s.openTask(null)} aria-label="Close"><X size={20} /></button>
      </header>

      <div className="detail-body" key={task.id}>
        {parent && (
          <button className="parent-link" onClick={() => s.openTask(parent.id)}>
            <CornerLeftUp size={14} />Part of {parent.title}
          </button>
        )}
        <div className="detail-title">
          <Check done={current === "done"} label={task.title} onToggle={() => s.updateTask(task.id, { status: current === "done" ? "todo" : "done" })} />
          <textarea
            className="title-input"
            rows={1}
            defaultValue={task.title}
            aria-label="Task name"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== task.title) s.updateTask(task.id, { title: v });
              else e.target.value = task.title;
            }}
          />
        </div>

        <div className="fields">
          <label>Status</label>
          <div className="seg status" role="radiogroup" aria-label="Status">
            {STATUSES.map((st) => (
              <button key={st.id} role="radio" aria-checked={current === st.id} className={(current === st.id ? "on " : "") + st.id} onClick={() => s.updateTask(task.id, { status: st.id })}>
                {st.label}
              </button>
            ))}
          </div>

          <label htmlFor="f-due">Due</label>
          <div className="field-row">
            <input id="f-due" type="date" value={task.due_date ?? ""} onChange={(e) => s.updateTask(task.id, { due_date: e.target.value || null })} />
            <DueBadge task={task} />
          </div>

          <label htmlFor="f-prio">Priority</label>
          <select id="f-prio" value={task.priority} onChange={(e) => s.updateTask(task.id, { priority: e.target.value as Priority })}>
            {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>

          <label htmlFor="f-proj">Project</label>
          <select id="f-proj" value={task.project_id} onChange={(e) => s.updateTask(task.id, { project_id: e.target.value })}>
            {s.data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <label>Assigned to</label>
          <div className="people-pick">
            {s.data.people.map((p) => (
              <button key={p.id} aria-pressed={assigned.has(p.id)} className={"person-chip" + (assigned.has(p.id) ? " on" : "")} onClick={() => s.toggleAssignee(task.id, p.id)}>
                <Avatar person={p} size={22} />{p.full_name}
              </button>
            ))}
          </div>
        </div>

        <section className="detail-section">
          <h3>Details</h3>
          <textarea
            className="desc"
            rows={3}
            defaultValue={task.description ?? ""}
            placeholder="Add anything that helps get this done"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (task.description ?? "")) s.updateTask(task.id, { description: v || null });
            }}
          />
        </section>

        <section className="detail-section">
          <h3>Subtasks{kids.length > 0 && <span className="count">{doneKids} of {kids.length} done</span>}</h3>
          {kids.length > 0 && <div className="bar thin"><span style={{ width: `${(100 * doneKids) / kids.length}%` }} /></div>}
          <div className="subtasks">
            {kids.map((k) => (
              <div key={k.id} className={"subtask" + (k.status === "done" ? " is-done" : "")}>
                <Check done={k.status === "done"} label={k.title} onToggle={() => s.updateTask(k.id, { status: k.status === "done" ? "todo" : "done" })} />
                <button className="subtask-title" onClick={() => s.openTask(k.id)}>{k.title}</button>
                <DueBadge task={k} />
              </div>
            ))}
          </div>
          <QuickAdd placeholder="Add a subtask" onAdd={(title) => s.addTask({ project_id: task.project_id, parent_task_id: task.id, title })} />
        </section>

        <Notes taskId={task.id} />
      </div>
    </aside>
  );
}

function Notes({ taskId }: { taskId: string }) {
  const s = useStore();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [body, setBody] = useState("");

  useEffect(() => {
    let live = true;
    s.api.notes(taskId).then((n) => live && setNotes(n)).catch(() => live && setNotes([]));
    return () => {
      live = false;
    };
  }, [s.api, taskId]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const note: Note = { id: uid(), task_id: taskId, author_id: s.data.userId, body: text, created_at: new Date().toISOString() };
    setNotes((n) => [...(n ?? []), note]);
    setBody("");
    s.api.insert("task_comments", { id: note.id, task_id: taskId, body: text }).catch(() => {
      s.toast("That note was not saved. Check your connection and add it again.");
      setNotes((n) => (n ?? []).filter((x) => x.id !== note.id));
    });
  };

  const remove = (id: string) => {
    setNotes((n) => (n ?? []).filter((x) => x.id !== id));
    s.api.remove("task_comments", id).catch(() => s.toast("That note was not deleted."));
  };

  return (
    <section className="detail-section">
      <h3>Notes{notes && notes.length > 0 && <span className="count">{notes.length}</span>}</h3>
      <div className="notes">
        {(notes ?? []).map((n) => (
          <div key={n.id} className="note">
            <p>{n.body}</p>
            <footer>
              <time>{new Date(n.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
              {n.author_id === s.data.userId && <button onClick={() => remove(n.id)}>Delete</button>}
            </footer>
          </div>
        ))}
      </div>
      <form className="note-form" onSubmit={add}>
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note"
          aria-label="Write a note"
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && add(e)}
        />
        <button className="btn" type="submit" disabled={!body.trim()}>Add note</button>
      </form>
    </section>
  );
}
