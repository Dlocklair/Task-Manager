import { useCallback, useEffect, useState } from "react";
import { Check, Send } from "lucide-react";
import { sb } from "../lib/supabase";
import type { Priority, Status } from "../lib/types";
import { dueLabel, dueTone, formatTime, step, STATUSES } from "../lib/util";
import { RichView } from "./RichText";
import { PriorityFlag } from "./ui";

/** What an update link shows. Comes from the shared_tasks database function. */
interface SharedTask {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  project: string | null;
  project_color: string | null;
  parent_title: string | null;
  notes: { body: string; created_at: string }[];
}
interface Shared {
  person: string;
  workspace: string;
  tasks: SharedTask[];
}

type Step = "todo" | "in_progress" | "done";

/** Sample content for ?update=demo, so the page can be tried without a real link. */
const DEMO: Shared = {
  person: "Maria Chen",
  workspace: "David's tasks",
  tasks: [
    { id: "d1", title: "Order the kitchen cabinets", description: "- Confirm measurements\n- Ask about the six week lead time", status: "todo", priority: "high", due_date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), due_time: null, project: "Kitchen remodel", project_color: "#3157E0", parent_title: null, notes: [] },
    { id: "d2", title: "Pick tile samples", description: null, status: "in_progress", priority: "medium", due_date: null, due_time: null, project: "Kitchen remodel", project_color: "#3157E0", parent_title: "Choose finishes", notes: [{ body: "Picked up three samples.", created_at: new Date().toISOString() }] },
  ],
};

/**
 * The page someone sees when they open an update link. No account is needed: the link itself is the key.
 * They can change the status of each task assigned to them and send a note. Both land in the owner's tasks.
 */
export function SharedTasks({ token }: { token: string }) {
  const demo = token === "demo" || !sb;
  const [data, setData] = useState<Shared | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (demo) {
      setData((d) => d ?? DEMO);
      return;
    }
    const { data: res, error: err } = await sb!.rpc("shared_tasks", { p_token: token });
    if (err) setError(err.message);
    else setData((res as Shared | null) ?? null);
  }, [demo, token]);

  useEffect(() => {
    void load();
    // Pick up changes made by the task owner while the page is open.
    const t = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(t);
  }, [load]);

  const send = async (task: SharedTask, status: Step | null, note: string | null): Promise<boolean> => {
    if (demo) {
      setData((d) => d && {
        ...d,
        tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, status: status ?? t.status, notes: note ? [...t.notes, { body: note, created_at: new Date().toISOString() }] : t.notes } : t)),
      });
      return true;
    }
    const { error: err } = await sb!.rpc("shared_update", { p_token: token, p_task_id: task.id, p_status: status, p_note: note });
    if (err) {
      setError(err.message);
      return false;
    }
    setError(null);
    await load();
    return true;
  };

  if (data === undefined && !error) return <div className="center-screen"><div className="spinner" aria-label="Loading" /></div>;
  if (!data) {
    return (
      <div className="center-screen">
        <div className="notice">
          <h2>This link doesn't work</h2>
          <p>{error ?? "It may have been turned off. Ask the person who sent it for a new one."}</p>
        </div>
      </div>
    );
  }

  const open = data.tasks.filter((t) => t.status !== "done");
  const done = data.tasks.filter((t) => t.status === "done");
  const first = data.person.trim().split(/\s+/)[0];

  return (
    <div className="shared">
      <header className="shared-head">
        <div className="brand"><span className="brand-mark" />Task Manager</div>
        <h1>{first ? `${first}, here are your tasks` : "Your tasks"}</h1>
        <p>Assigned to you in {data.workspace}. Change a task's status or send a note, and it updates for them right away.</p>
      </header>
      {error && <p className="shared-error" role="alert">{error}</p>}
      {open.length === 0 && <div className="empty"><strong>Nothing open right now</strong><span>Every task assigned to you is done.</span></div>}
      <div className="shared-list">
        {open.map((t) => <SharedCard key={t.id} task={t} onSend={send} />)}
      </div>
      {done.length > 0 && (
        <>
          <h2 className="shared-sub">Finished recently</h2>
          <div className="shared-list">{done.map((t) => <SharedCard key={t.id} task={t} onSend={send} />)}</div>
        </>
      )}
    </div>
  );
}

function SharedCard({ task, onSend }: { task: SharedTask; onSend(task: SharedTask, status: Step | null, note: string | null): Promise<boolean> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const current = step(task.status);
  const run = async (status: Step | null, text: string | null) => {
    setBusy(true);
    const ok = await onSend(task, status, text);
    setBusy(false);
    if (ok && text) setNote("");
  };
  return (
    <article className={"shared-card" + (current === "done" ? " is-done" : "")} style={{ ["--pc" as string]: task.project_color ?? "#5B6B86" }}>
      <div className="shared-card-top">
        <h3>{task.title}</h3>
        <PriorityFlag priority={task.priority} withLabel />
      </div>
      <div className="shared-facts">
        {task.project && <span className="proj-chip"><i />{task.project}</span>}
        {task.parent_title && <span>Part of: {task.parent_title}</span>}
        {task.due_date && (
          <span className={`due ${dueTone(task.due_date)}`}>
            Due {dueLabel(task.due_date)}{task.due_time ? ` at ${formatTime(task.due_time.slice(0, 5))}` : ""}
          </span>
        )}
      </div>
      {task.description?.trim() && <RichView text={task.description} />}

      <div className="seg shared-status" role="group" aria-label="Status">
        {STATUSES.map((s) => (
          <button key={s.id} className={current === s.id ? "on" : ""} aria-pressed={current === s.id} disabled={busy} onClick={() => current !== s.id && void run(s.id as Step, null)}>
            {current === s.id && <Check size={15} />}{s.label}
          </button>
        ))}
      </div>

      {task.notes.length > 0 && (
        <div className="shared-notes">
          {task.notes.map((n, i) => (
            <div key={i} className="note">
              <RichView text={n.body} />
              <footer><time>{new Date(n.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></footer>
            </div>
          ))}
        </div>
      )}

      <form
        className="shared-note-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (note.trim()) void run(null, note.trim());
        }}
      >
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note or an update" aria-label={`Note for ${task.title}`} maxLength={4000} />
        <button className="btn primary small" type="submit" disabled={busy || !note.trim()}><Send size={15} />Send</button>
      </form>
    </article>
  );
}
