import { useState, type FormEvent } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { addDays, byUrgency, firstName, greeting, isoDay, tint } from "../lib/util";
import { TaskRow } from "./TaskList";
import { Avatar, Empty, Modal } from "./ui";

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
  const [pick, setPick] = useState<string | null>(null);
  const person = s.data.people.find((p) => p.id === pick);
  const theirs = person ? s.tasksFor(person.id).filter((t) => t.status !== "done").sort(byUrgency) : [];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>People</h1>
          <p className="date-line">Anyone you assign tasks to. They don't need an account.</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} />Add person</button>
      </header>

      <div className="people-grid">
        {s.data.people.map((p) => {
          const open = s.tasksFor(p.id).filter((t) => t.status !== "done").length;
          return (
            <button key={p.id} className={"person-card" + (pick === p.id ? " on" : "")} style={tint(p.color)} aria-pressed={pick === p.id} onClick={() => setPick(pick === p.id ? null : p.id)}>
              <Avatar person={p} size={44} />
              <span className="person-name">{p.full_name}{p.user_id === s.data.userId && <em>You</em>}</span>
              <span className="person-count">{open} open task{open === 1 ? "" : "s"}</span>
            </button>
          );
        })}
      </div>

      {person && (
        <section className="group">
          <div className="group-bar">
            <h2 className="group-head"><i />Open tasks for {firstName(person.full_name)}<span>{theirs.length}</span></h2>
            {person.user_id !== s.data.userId && (
              <button
                className="btn quiet danger"
                onClick={() => {
                  if (window.confirm(`Remove ${person.full_name}? They will be unassigned from ${theirs.length} open task${theirs.length === 1 ? "" : "s"}.`)) {
                    s.deletePerson(person.id);
                    setPick(null);
                  }
                }}
              >
                <Trash2 size={15} />Remove person
              </button>
            )}
          </div>
          {theirs.length ? <div className="rows">{theirs.map((t) => <TaskRow key={t.id} task={t} showProject />)}</div> : <Empty title={`${firstName(person.full_name)} has no open tasks`} />}
        </section>
      )}

      {adding && <PersonDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function PersonDialog({ onClose }: { onClose(): void }) {
  const s = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    s.addPerson(name.trim(), email.trim() || null);
    onClose();
  };
  return (
    <Modal title="Add person" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required /></label>
        <label>Email <small>optional</small><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>Add person</button>
        </div>
      </form>
    </Modal>
  );
}
