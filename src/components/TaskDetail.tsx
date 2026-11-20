import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CornerLeftUp, Trash2, X } from "lucide-react";
import { useStore } from "../lib/store";
import type { Note, Task } from "../lib/types";
import { step, tint } from "../lib/util";
import { RichEditor, RichField, RichView } from "./RichText";
import { QuickAdd } from "./TaskList";
import { Check } from "./ui";
import { Subtasks } from "./Subtasks";
import { TaskFields } from "./TaskFields";

export function TaskDetail({ task }: { task: Task }) {
  const s = useStore();
  const project = s.project(task.project_id);
  const parent = task.parent_task_id ? s.task(task.parent_task_id) : undefined;
  const kids = s.kids(task.id);
  const doneKids = kids.filter((k) => k.status === "done").length;
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
        <span className={"proj-chip" + (project ? "" : " none")}><i />{project?.name ?? "No project"}</span>
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

        <TaskFields task={task} />

        <section className="detail-section">
          <h3>Details</h3>
          <RichField
            value={task.description ?? ""}
            label="details"
            placeholder="Add details, bullets or steps"
            onSave={(v) => s.updateTask(task.id, { description: v })}
          />
        </section>

        <section className="detail-section">
          <h3>Subtasks{kids.length > 0 && <span className="count">{doneKids} of {kids.length} done</span>}</h3>
          {kids.length > 0 && <div className="bar thin"><span style={{ width: `${(100 * doneKids) / kids.length}%` }} /></div>}
          <Subtasks kids={kids} />
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
  // The draft lives in the store, so switching tasks or closing the panel can ask before losing it.
  const body = s.drafts[taskId] ?? "";
  const setBody = (text: string) => s.setDraft(taskId, text);

  // Fetched again when the server sends fresh data, so a note added through an update link appears here.
  useEffect(() => {
    let live = true;
    s.api.notes(taskId).then((n) => live && setNotes(n)).catch(() => live && setNotes((cur) => cur ?? []));
    return () => {
      live = false;
    };
  }, [s.api, taskId, s.synced]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const note = s.saveDraft(taskId);
    if (note) setNotes((n) => [...(n ?? []), note]);
  };

  const edit = (id: string, text: string) => {
    const now = new Date().toISOString();
    setNotes((n) => (n ?? []).map((x) => (x.id === id ? { ...x, body: text, updated_at: now } : x)));
    s.api.update("task_comments", id, { body: text }).catch(() => s.toast("That change to the note was not saved."));
  };

  const remove = (id: string) => {
    setNotes((n) => (n ?? []).filter((x) => x.id !== id));
    s.api.remove("task_comments", id).catch(() => s.toast("That note was not deleted."));
  };

  return (
    <section className="detail-section">
      <h3>Notes{notes && notes.length > 0 && <span className="count">{notes.length}</span>}</h3>
      {body.trim() && <p className="draft-warning" role="status">This note is not added yet. Press Add note to save it.</p>}
      <div className="notes">
        {(notes ?? []).map((n) => (
          <NoteItem key={n.id} note={n} mine={n.author_id === s.data.userId} onEdit={(text) => edit(n.id, text)} onDelete={() => remove(n.id)} />
        ))}
      </div>
      <form className="note-form" onSubmit={add}>
        <RichEditor
          value={body}
          onChange={setBody}
          rows={3}
          placeholder="Write a note. Use the list buttons for bullets or numbers."
          ariaLabel="Write a note"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              add(e as unknown as FormEvent);
            }
          }}
        />
        <button className="btn primary" type="submit" disabled={!body.trim()}>Add note</button>
      </form>
    </section>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** One note. Your own notes can be edited in place or deleted. */
function NoteItem({ note, mine, onEdit, onDelete }: { note: Note; mine: boolean; onEdit(text: string): void; onDelete(): void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const edited = note.updated_at && new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 1000;

  const save = () => {
    const v = draft.trim();
    if (!v) return;
    if (v !== note.body.trim()) onEdit(v);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(note.body);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="note is-editing">
        <RichEditor
          value={draft}
          onChange={setDraft}
          rows={3}
          autoFocus
          placeholder="Write a note"
          ariaLabel="Edit note"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              cancel();
            }
          }}
        />
        <div className="note-edit-actions">
          <button type="button" className="btn small" onClick={cancel}>Cancel</button>
          <button type="button" className="btn small primary" disabled={!draft.trim()} onClick={save}>Save note</button>
        </div>
      </div>
    );
  }

  return (
    <div className="note">
      <RichView text={note.body} />
      <footer>
        <time>{note.author_name && <strong className="note-by">{note.author_name} · </strong>}{when(note.created_at)}{edited && <span title={`Edited ${when(note.updated_at!)}`}> · edited</span>}</time>
        {mine && (
          <span className="note-actions">
            <button onClick={() => { setDraft(note.body); setEditing(true); }}>Edit</button>
            <button className="danger" onClick={() => window.confirm("Delete this note?") && onDelete()}>Delete</button>
          </span>
        )}
      </footer>
    </div>
  );
}
