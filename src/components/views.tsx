import { useEffect, useState, type FormEvent } from "react";
import { Check as CheckIcon, Settings as SettingsIcon } from "lucide-react";
import { Link2, Mail, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useStore } from "../lib/store";
import type { Person, SortKey, Task } from "../lib/types";
import type { ReorderScope } from "../lib/drag";
import { addDays, byDueThenPriority, byUrgency, COLORS, firstName, greeting, isoDay, sortCompare, tint } from "../lib/util";
import { NO_SEARCH, rememberSort, reorderMode, savedSort, searchTasks, SORT_OPTIONS, type TextSearch } from "../lib/listing";
import { CategoryDialog } from "./Shell";
import { buildOutline, type Outline } from "../lib/outline";
import { EmailDialog } from "./EmailDialog";
import { TaskRow } from "./TaskList";
import { SearchBox } from "./SearchBox";
import { TopActions } from "./TopActions";
import { groupProjects } from "../lib/categories";
import { PeoplePicks } from "./PeoplePicks";
import { Avatar, Empty, Modal, Swatches } from "./ui";

function buckets(tasks: Task[], order: (a: Task, b: Task) => number = byUrgency) {
  const today = isoDay(), week = addDays(7);
  const open = tasks.filter((t) => t.status !== "done").sort(order);
  return {
    late: open.filter((t) => t.due_date && t.due_date < today),
    today: open.filter((t) => t.due_date === today),
    week: open.filter((t) => t.due_date && t.due_date > today && t.due_date <= week),
    later: open.filter((t) => t.due_date && t.due_date > week),
    undated: open.filter((t) => !t.due_date),
  };
}

function Section({ title, tone, tasks, mode = null }: { title: string; tone?: string; tasks: Task[]; mode?: ReorderScope["mode"] | null }) {
  if (!tasks.length) return null;
  // Each due-date section is its own group: tasks can be dragged within it, not into another one.
  const reorder: ReorderScope | undefined = mode ? { list: tasks, mode } : undefined;
  return (
    <section className="group">
      <h2 className={`group-head ${tone ?? ""}`}><i />{title}<span>{tasks.length}</span></h2>
      <div className="rows">{tasks.map((t) => <TaskRow key={t.id} task={t} showProject reorder={reorder} />)}</div>
    </section>
  );
}

export function Home({ onNewProject }: { onNewProject(): void }) {
  const s = useStore();
  const [search, setSearch] = useState<TextSearch>(NO_SEARCH);
  const b = buckets(s.data.tasks);
  const q = search.q.trim();
  const found = q ? searchTasks(s.data.tasks, search).sort(byUrgency) : [];
  const name = s.me ? firstName(s.me.full_name) : "";

  return (
    <div className="page">
      <header className="page-head page-head-stack">
        <div className="page-head-row">
          <span className="date-with-gear">
            <p className="date-line">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
            {/* Phones have no sidebar, so Settings is reached from here. */}
            <button className="icon-btn mobile-only" onClick={() => s.go({ kind: "settings" })} aria-label="Settings"><SettingsIcon size={19} /></button>
          </span>
          <TopActions />
        </div>
        <div className="page-head-row">
          <h1>{greeting()}{name && `, ${name}`}</h1>
          <SearchBox
            value={search.q}
            onChange={(v) => setSearch({ ...search, q: v })}
            includeClosed={search.includeClosed}
            onIncludeClosed={(v) => setSearch({ ...search, includeClosed: v })}
            placeholder="Search all tasks"
          />
        </div>
      </header>

      {q ? (
        found.length ? (
          <>
            <p className="search-count">{found.length} {found.length === 1 ? "match" : "matches"}{search.includeClosed ? ", closed tasks included" : ", open tasks only"}</p>
            <div className="rows">{found.map((t) => <TaskRow key={t.id} task={t} showProject />)}</div>
          </>
        ) : (
          <Empty title={`Nothing matches "${q}"`}>{search.includeClosed ? "Try a shorter word, or check the spelling." : "Tick Include closed to search finished tasks too."}</Empty>
        )
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
  const groups = groupProjects(s.data.projects, s.data.categories);
  const nested = s.data.categories.length > 0;
  return (
    <>
      {groups.map((group) => (
        <section key={group.category?.id ?? "none"} className="card-group">
          {nested && <h3 className="card-group-title">{group.category?.name ?? "No category"}</h3>}
          <div className={"project-cards" + (nested ? " nested" : "")}>
            {group.projects.map((p) => {
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
            {group.projects.length === 0 && <p className="group-empty">No projects in this category yet.</p>}
          </div>
        </section>
      ))}
    </>
  );
}

export function Projects({ onNewProject }: { onNewProject(): void }) {
  const s = useStore();
  const [managing, setManaging] = useState(false);
  return (
    <div className="page">
      <header className="page-head">
        <h1>Projects</h1>
        <span className="header-actions">
          <button className="btn" onClick={() => setManaging(true)}><Tags size={16} />Categories</button>
          <button className="btn primary" onClick={onNewProject}><Plus size={16} />New project</button>
          <TopActions />
        </span>
      </header>
      {managing && <CategoryDialog onClose={() => setManaging(false)} />}
      {s.data.projects.length ? <ProjectCards /> : <Empty title="No projects yet">Create one to start adding tasks.</Empty>}
    </div>
  );
}

export function MyTasks() {
  const s = useStore();
  const [search, setSearch] = useState<TextSearch>(NO_SEARCH);
  const [sortBy, setSortBy] = useState<SortKey>(() => savedSort("my") ?? "due");
  const mine = s.me ? s.tasksFor(s.me.id) : [];
  const b = buckets(mine, sortCompare(sortBy, () => ""));
  const mode = reorderMode(sortBy);
  const open = mine.filter((t) => t.status !== "done").length;
  const q = search.q.trim();
  const found = q ? searchTasks(mine, search).sort(byUrgency) : [];
  return (
    <div className="page">
      <header className="page-head page-head-stack">
        <div className="page-head-row">
          <h1>My tasks</h1>
          <TopActions />
        </div>
        <div className="page-head-row">
          <p className="date-line">{open === 0 ? "Nothing is assigned to you right now" : `${open} open task${open === 1 ? "" : "s"} assigned to you`}</p>
          <SearchBox
            value={search.q}
            onChange={(v) => setSearch({ ...search, q: v })}
            includeClosed={search.includeClosed}
            onIncludeClosed={(v) => setSearch({ ...search, includeClosed: v })}
            placeholder="Search my tasks"
          />
        </div>
        <div className="page-head-row my-sort">
          <label>
            <span>Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => {
                const v = e.target.value as SortKey;
                rememberSort("my", v);
                setSortBy(v);
              }}
            >
              {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          {mode && <span className="field-hint">Drag the <b>⋮⋮</b> handle to move a task within its section.</span>}
        </div>
      </header>
      {q ? (
        found.length ? (
          <>
            <p className="search-count">{found.length} {found.length === 1 ? "match" : "matches"}{search.includeClosed ? ", closed tasks included" : ", open tasks only"}</p>
            <div className="rows">{found.map((t) => <TaskRow key={t.id} task={t} showProject />)}</div>
          </>
        ) : (
          <Empty title={`Nothing matches "${q}"`}>{search.includeClosed ? "Try a shorter word, or check the spelling." : "Tick Include closed to search finished tasks too."}</Empty>
        )
      ) : open === 0 ? (
        <Empty title="You're all caught up">Tasks appear here when you assign them to yourself.</Empty>
      ) : (
        <>
          <Section title="Overdue" tone="late" tasks={b.late} mode={mode} />
          <Section title="Today" tone="today" tasks={b.today} mode={mode} />
          <Section title="Next 7 days" tone="week" tasks={b.week} mode={mode} />
          <Section title="Later" tasks={b.later} mode={mode} />
          <Section title="No due date" tasks={b.undated} mode={mode} />
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
  const [email, setEmail] = useState<{ to: string[]; outline: Outline; personId: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const person = s.data.people.find((p) => p.id === pick);
  const theirs = person ? s.tasksFor(person.id).filter((t) => t.status !== "done").sort(byDueThenPriority) : [];
  const theirsDated = theirs.filter((t) => t.due_date);
  const theirsUndated = theirs.filter((t) => !t.due_date);
  // Only people other than you can be deleted here; your own entry stays.
  const deletable = s.data.people.filter((p) => p.user_id !== s.data.userId);
  const chosen = s.selecting ? deletable.filter((p) => selected.has(p.id)) : [];
  // Leaving select mode clears any people that were ticked.
  useEffect(() => {
    if (!s.selecting) setSelected(new Set());
  }, [s.selecting]);

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
        <span className="header-actions">
          <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} />Add person</button>
        </span>
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
              <button className="person-edit" aria-label={`Edit ${p.full_name}`} title="Edit details" onClick={() => setEditing(p)}>
                <Pencil size={14} />
              </button>
              {!isMe && s.selecting && (
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
              <button
                className="btn quiet"
                onClick={() =>
                  setEmail({
                    to: person.email ? [person.email] : [],
                    personId: person.id,
                    outline: buildOutline(s, theirs, {
                      title: `Open tasks for ${person.full_name}`,
                      intro: [`Hi ${firstName(person.full_name)},`, "", theirs.length ? `Here are your open tasks (${theirs.length}):` : "You have no open tasks right now."],
                      showProject: true,
                      showPeople: false,
                    }),
                  })
                }
              >
                <Mail size={15} />Email tasks
              </button>
              {s.api.createShareLink && person.user_id !== s.data.userId && <UpdateLinkButton personId={person.id} name={firstName(person.full_name)} />}
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
          {theirs.length ? (
            <>
              <p className="field-hint person-sort-note">Sorted by due date. Tasks with no date follow, highest priority first.</p>
              {theirsDated.length > 0 && <div className="rows">{theirsDated.map((t) => <TaskRow key={t.id} task={t} showProject />)}</div>}
              {theirsUndated.length > 0 && (
                <>
                  <h3 className="sub-head">No due date<span>{theirsUndated.length}</span></h3>
                  <div className="rows">{theirsUndated.map((t) => <TaskRow key={t.id} task={t} showProject />)}</div>
                </>
              )}
            </>
          ) : <Empty title={`${firstName(person.full_name)} has no open tasks`} />}
        </section>
      )}

      {email && <EmailDialog to={email.to} outline={email.outline} personId={email.personId} onClose={() => setEmail(null)} />}
      {adding && <PersonDialog onClose={() => setAdding(false)} />}
      {editing && <PersonDialog person={editing} onClose={() => setEditing(null)} onDeleted={() => { setPick(null); setEditing(null); }} />}
    </div>
  );
}

/**
 * An update link lets this person open their tasks in a browser, with no account, and mark them done or add notes.
 * Their changes land straight in your tasks. Turning the link off stops it working at once.
 */
function UpdateLinkButton({ personId, name }: { personId: string; name: string }) {
  const s = useStore();
  const link = s.shareLinkFor(personId);
  const [busy, setBusy] = useState(false);
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      s.toast(`Update link copied. Send it to ${name}; it opens their tasks with no sign-in.`);
    } catch {
      window.prompt("Copy this link", url);
    }
  };
  if (!link) {
    return (
      <button
        className="btn quiet"
        disabled={busy}
        title={`Make a link ${name} can use to update their tasks`}
        onClick={async () => {
          setBusy(true);
          const made = await s.createShareLink(personId);
          setBusy(false);
          if (made) void copy(s.shareUrl(made));
        }}
      >
        <Link2 size={15} />{busy ? "Making link…" : "Update link"}
      </button>
    );
  }
  return (
    <span className="link-pair">
      <button className="btn quiet" onClick={() => void copy(s.shareUrl(link))} title={`Copy ${name}'s update link`}><Link2 size={15} />Copy update link</button>
      <button
        className="btn quiet small"
        onClick={() => {
          if (window.confirm(`Turn off ${name}'s update link? It will stop working right away. You can make a new one later.`)) s.removeShareLink(personId);
        }}
      >
        Turn off
      </button>
    </span>
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
