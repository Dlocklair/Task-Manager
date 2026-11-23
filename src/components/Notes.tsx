import { useEffect, useState, type FormEvent } from "react";
import { useStore } from "../lib/store";
import type { Note } from "../lib/types";
import { RichEditor, RichView } from "./RichText";
import { firstLine, Fold } from "./Fold";

/** A task's notes, folded until opened. compact is the smaller version shown inside an opened subtask. */
export function Notes({ taskId, compact = false }: { taskId: string; compact?: boolean }) {
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

  const list = notes ?? [];
  const latest = list[list.length - 1];
  return (
    <Fold
      title="Notes"
      count={list.length}
      preview={latest ? firstLine(latest.body) : ""}
      empty="No notes yet"
      open={!!body.trim()}
      compact={compact}
    >
      {(byClick) => (
        <>
          {body.trim() && <p className="draft-warning" role="status">This note is not added yet. Press Add note to save it.</p>}
          {list.length > 0 && (
            <div className="notes">
              {list.map((n) => (
                <NoteItem key={n.id} note={n} mine={n.author_id === s.data.userId} onEdit={(text) => edit(n.id, text)} onDelete={() => remove(n.id)} />
              ))}
            </div>
          )}
          <form className="note-form" onSubmit={add}>
            <RichEditor
              value={body}
              onChange={setBody}
              rows={compact ? 2 : 3}
              autoFocus={byClick && list.length === 0}
              placeholder={compact ? "Add a note to this subtask" : "Write a note. Use the list buttons for bullets or numbers."}
              ariaLabel="Write a note"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  add(e as unknown as FormEvent);
                }
              }}
            />
            <button className={"btn primary" + (compact ? " small" : "")} type="submit" disabled={!body.trim()}>Add note</button>
          </form>
        </>
      )}
    </Fold>
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
