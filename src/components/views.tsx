import { useState, type FormEvent } from "react";
import { Check as CheckIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "../lib/store";
import type { Person, Task } from "../lib/types";
import { addDays, byUrgency, COLORS, firstName, greeting, isoDay, tint } from "../lib/util";
import { TaskRow } from "./TaskList";
import { PeoplePicks } from "./PeoplePicks";
import { Avatar, Empty, Modal, Swatches } from "./ui";

function buckets(tasks: Task[]) {
  const today = isoDay(), week = addDays(7);
  const open = tasks.filter((t) => t.status !== "done").sort(byUrgency);
  return {
    late: open.filter((t) => t.due_date && t.due_date < today),
    today: open.filter((t) => t.due_date === today),
    week: open.filter((t) => t.due_date && t.due_date > today && t.due_date <= week),
    later: open.filter((t) => t.due_date && t.due_date > week),
    undated: open.filter((t) => !t.due_date),
  };
}

function Section({ title, tone, tasks }: { title: string; tone?: string; tasks: Task[] }) {
  if (!tasks.length) return null;
  return (
    <section className="group">
      <h2 className={`group-head ${tone ?? ""}`}><i />{title}<span>{tasks.length}</span></h2>
      <div className="rows">{tasks.map((t) => <TaskRow key={t.id} task={t} showProject />)}</div>
    </section>
  );
}

export function Home({ onNewProject }: { onNewProject(): void }) {
  const s = useStore();
  const [query, setQuery] = useState("");
  const b = buckets(s.data.tasks);
  const q = query.trim().toLowerCase();
  const found = q ? s.data.tasks.filter((t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q)).sort(byUrgency) : [];
  const name = s.me ? firstName(s.me.full_name) : "";

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="date-line">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>{greeting()}{name && `, ${name}`}</h1>
        </div>
        <label className="search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all tasks" aria-label="Search all tasks" />
        </label>
      </header>

      {q ? (
        found.length ? <div className="rows">{found.map((t) => <TaskRow key={t.id} task={t} showProject />)}</div> : <Empty title={`Nothing matches "${query.trim()}"`}>Try a shorter word, or check the spelling.</Empty>
      ) : s.data.projects.length === 0 ? (
        <Empty title="Start with a project">
          Projects hold your tasks. Create one for anything you are working on.
          <button className="btn primary" onClick={onNewProject}><Plus size={16} />New project</button>
        </Empty>
      ) : (
        <div className="home-grid">
          <div>
            <div className="tally">
              <div className="tally-item late"><strong>{b.late.length}</strong>overdue</div>
              <div className="tally-item today"><strong>{b.today.length}</strong>due today</div>
              <div className="tally-item week"><strong>{b.week.length}</strong>next 7 days</div>
            </div>
            <Section title="Overdue" tone="late" tasks={b.late} />
            <Section title="Today" tone="today" tasks={b.today} />
            <Section title="Next 7 days" tone="week" tasks={b.week} />
            {b.late.length + b.today.length + b.week.length === 0 && (
              <Empty title="Nothing is due this week">Open a project to plan what comes next.</Empty>
            )}
          </div>
          <aside className="home-side">
            <h2 className="side-title">Projects</h2>
            <ProjectCards />
          </aside>
        </div>
      )}
    </div>
  );
}

function ProjectCards() {
  const s = useStore();
  return (
    <div className="project-cards">
      {s.data.projects.map((p) => {
        const g = s.progress(p.id);
        return (
          <button key={p.id} className="project-card" style={tint(p.color)} onClick={() => s.go({ kind: "project", id: p.id })}>
            <span className="project-card-name">{p.name}</span>
            <span className="project-card-pct">{g.pct}%</span>
            <div className="bar thin"><span style={{ width: `${g.pct}%` }} /></div>
            <span className="project-card-meta">
              {g.total - g.done} open{g.late > 0 && <em>{g.late} overdue</em>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Projects({ onNewProject }: { onNewProject(): void }) {
  const s = useStore();
  return (
    <div className="page">
      <header className="page-head">
        <h1>Projects</h1>
        <button className="btn primary" onClick={onNewProject}><Plus size={16} />New project</button>
      </header>
      {s.data.projects.length ? <ProjectCards /> : <Empty title="No projects yet">Create one to start adding tasks.</Empty>}
    </div>
  );
}

export function MyTasks() {
  const s = useStore();
  const mine = s.me ? s.tasksFor(s.me.id) : [];
  const b = buckets(mine);
  const open = mine.filter((t) => t.status !== "done").length;
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>My tasks</h1>
          <p className="date-line">{open === 0 ? "Nothing is assigned to you right now" : `${open} open task${open === 1 ? "" : "s"} assigned to you`}</p>
        </div>
      </header>
      {open === 0 ? (
        <Empty title="You're all caught up">Tasks appear here when you assign them to yourself.</Empty>
      ) : (
        <>
          <Section title="Overdue" tone="late" tasks={b.late} />
          <Section title="Today" tone="today" tasks={b.today} />
          <Section title="Next 7 days" tone="week" tasks={b.week} />
          <Section title="Later" tasks={b.later} />
          <Section title="No due date" tasks={b.undated} />
        </>
      )}
    </div>
  );
}

export function People() {
  const s = useStore();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const person = s.data.people.find((p) => p.id === pick);
  const theirs = person ? s.tasksFor(person.id).filter((t) => t.status !== "done").sort(byUrgency) : [];
  // Only people other than you can be deleted here; your own entry stays.
  const deletable = s.data.people.filter((p) => p.user_id !== s.data.userId);
  const chosen = deletable.filter((p) => selected.has(p.id));

  const toggleSelected = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteChosen = () => {
    const tasks = new Set(chosen.flatMap((p) => s.tasksFor(p.id).map((t) => t.id))).size;
    const names = chosen.map((p) => p.full_name).join(", ");
    const msg = `Delete ${chosen.length === 1 ? chosen[0].full_name : `${chosen.length} people`} (${names})? ` +
      `${tasks ? `They will be removed from ${tasks} task${tasks === 1 ? "" : "s"}. ` : ""}This can't be undone.`;
    if (!window.confirm(msg)) return;
    if (pick && selected.has(pick)) setPick(null);
    chosen.forEach((p) => s.deletePerson(p.id));
    setSelected(new Set());
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>People</h1>
          <p className="date-line">Anyone you assign tasks to. They don't need an account.</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} />Add person</button>
      </header>

      <section className="defaults-card" aria-labelledby="defaults-title">
        <div>
          <h2 id="defaults-title">Assigned to by default</h2>
          <p className="field-hint">New tasks in every project start with these people. A project can choose its own list instead.</p>
        </div>
        <PeoplePicks
          label="Default assignees for new tasks"
          value={s.data.workspace.default_assignee_ids}
          onChange={(ids) => s.setWorkspaceDefaults(ids)}
        />
      </section>

      {chosen.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Selected people">
          <strong>{chosen.length} selected</strong>
          <span className="grow" />
          <button className="btn small" onClick={() => setSelected(new Set())}>Clear</button>
          <button className="btn small danger-solid" onClick={deleteChosen}><Trash2 size={14} />Delete selected</button>
        </div>
      )}

      <div className="people-grid">
        {s.data.people.map((p) => {
          const open = s.tasksFor(p.id).filter((t) => t.status !== "done").length;
          const isMe = p.user_id === s.data.userId;
          return (
            <div key={p.id} className="person-wrap">
              {!isMe && (
                <label className="person-select" title={`Select ${p.full_name}`}>
                  <input type="checkbox" className="pick-box-input" checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} />
                  <span className={"pick-box" + (selected.has(p.id) ? " on" : "")} aria-hidden="true">
                    {selected.has(p.id) && <CheckIcon size={14} strokeWidth={3.2} />}
                  </span>
                  <span className="sr-only">Select {p.full_name}</span>
                </label>
              )}
              <button className={"person-card" + (pick === p.id ? " on" : "")} style={tint(p.color)} aria-pressed={pick === p.id} onClick={() => setPick(pick === p.id ? null : p.id)}>
                <Avatar person={p} size={44} />
                <span className="person-name">{p.full_name}{isMe && <em>You</em>}</span>
                <span className="person-count">{open} open task{open === 1 ? "" : "s"}</span>
              </button>
            </div>
          );
        })}
      </div>

      {person && (
        <section className="group">
          <div className="group-bar">
            <h2 className="group-head"><i />Open tasks for {firstName(person.full_name)}<span>{theirs.length}</span></h2>
            <div className="group-actions">
              <button className="btn quiet" onClick={() => setEditing(person)}><Pencil size={15} />Edit</button>
              {person.user_id !== s.data.userId && (
                <button
                  className="btn quiet danger"
                  onClick={() => {
                    if (window.confirm(`Delete ${person.full_name}? They will be removed from ${theirs.length} open task${theirs.length === 1 ? "" : "s"}.`)) {
                      s.deletePerson(person.id);
                      setPick(null);
                    }
                  }}
                >
                  <Trash2 size={15} />Delete
                </button>
              )}
            </div>
          </div>
          {theirs.length ? <div className="rows">{theirs.map((t) => <TaskRow key={t.id} task={t} showProject />)}</div> : <Empty title={`${firstName(person.full_name)} has no open tasks`} />}
        </section>
      )}

      {adding && <PersonDialog onClose={() => setAdding(false)} />}
      {editing && <PersonDialog person={editing} onClose={() => setEditing(null)} onDeleted={() => { setPick(null); setEditing(null); }} />}
    </div>
  );
}

function PersonDialog({ person, onClose, onDeleted }: { person?: Person; onClose(): void; onDeleted?(): void }) {
  const s = useStore();
  const [name, setName] = useState(person?.full_name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [color, setColor] = useState(person?.color ?? COLORS[s.data.people.length % COLORS.length]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (person) s.updatePerson(person.id, { full_name: name.trim(), email: email.trim() || null, color });
    else s.addPerson(name.trim(), email.trim() || null, color);
    onClose();
  };
  const canDelete = person && person.user_id !== s.data.userId;
  const taskCount = person ? s.tasksFor(person.id).length : 0;
  return (
    <Modal title={person ? "Edit person" : "Add person"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required /></label>
        <label>Email <small>optional</small><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></label>
        <div className="form-field">Color<Swatches value={color} onChange={setColor} colors={COLORS.includes(color) ? COLORS : [color, ...COLORS]} /></div>
        <div className="form-actions">
          {canDelete && (
            <button
              type="button"
              className="btn quiet danger"
              onClick={() => {
                if (window.confirm(`Delete ${person!.full_name}? They will be removed from ${taskCount} task${taskCount === 1 ? "" : "s"}.`)) {
                  s.deletePerson(person!.id);
                  onDeleted?.();
                  onClose();
                }
              }}
            >
              <Trash2 size={15} />Delete person
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>{person ? "Save changes" : "Add person"}</button>
        </div>
      </form>
    </Modal>
  );
}
