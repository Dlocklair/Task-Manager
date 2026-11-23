import { useState, type FormEvent } from "react";
import { Bookmark, ChevronDown, CircleCheck, Compass, FolderKanban, House, LayoutList, LogOut, Plus, Settings, Tags, Users, X } from "lucide-react";
import { groupProjects } from "../lib/categories";
import { useStore } from "../lib/store";
import { DuePicker } from "./DuePicker";
import type { Category, Priority, Project, View } from "../lib/types";
import { COLORS, PRIORITIES, tint } from "../lib/util";
import { Avatar, Modal, Swatches } from "./ui";
import { PeopleDropdown } from "./PeopleDropdown";

const NAV: { view: View; label: string; icon: typeof House }[] = [
  { view: { kind: "home" }, label: "Home", icon: House },
  { view: { kind: "all" }, label: "All tasks", icon: LayoutList },
  { view: { kind: "my" }, label: "My tasks", icon: CircleCheck },
  { view: { kind: "people" }, label: "People", icon: Users },
];

/** Picked in the project form to create a category on save. */
export const NEW_CATEGORY = "__new__";

export function Sidebar({ onNewProject, onSignOut }: { onNewProject(): void; onSignOut?: () => void }) {
  const s = useStore();
  const [managing, setManaging] = useState(false);
  const myOpen = s.me ? s.tasksFor(s.me.id).filter((t) => t.status !== "done").length : 0;
  return (
    <nav className="side" aria-label="Main">
      <div className="brand"><span className="brand-mark" />Task Manager</div>
      <div className="side-nav">
        {NAV.map(({ view, label, icon: Icon }) => (
          <button key={label} className={"side-link" + (s.view.kind === view.kind && !("filterId" in s.view && s.view.filterId) ? " on" : "")} onClick={() => s.go(view)}>
            <Icon size={18} />{label}
            {view.kind === "my" && myOpen > 0 && <span className="badge">{myOpen}</span>}
          </button>
        ))}
      </div>

      <SavedFilterLinks />

      <SideProjects onNewProject={onNewProject} onManage={() => setManaging(true)} />
      {managing && <CategoryDialog onClose={() => setManaging(false)} />}

      <div className="side-foot">
        {s.me && <Avatar person={s.me} size={30} />}
        <span className="grow who">{s.me?.full_name ?? s.data.email}{s.api.demo && <small>Sample data, nothing is saved</small>}{s.api.local && <small>Saved on this device only</small>}</span>
        <button className={"icon-btn on-dark" + (s.view.kind === "setup" ? " on" : "")} onClick={() => s.go({ kind: "setup" })} aria-label="Setup guide" title="Setup guide">
          <Compass size={17} />
        </button>
        <button className={"icon-btn on-dark" + (s.view.kind === "settings" ? " on" : "")} onClick={() => s.go({ kind: "settings" })} aria-label="Settings" title="Settings">
          <Settings size={17} />
        </button>
        {onSignOut && (
          <button className="icon-btn on-dark" onClick={onSignOut} aria-label={s.api.local ? "Leave device-only mode" : "Sign out"} title={s.api.local ? "Leave device-only mode and sign in" : "Sign out"}>
            <LogOut size={17} />
          </button>
        )}
      </div>
    </nav>
  );
}

const FILTERS_OPEN_KEY = "tm-side-filters-open";
const PROJECTS_OPEN_KEY = "tm-side-projects-open";

/** Open or closed, remembered on this device. */
function useFold(key: string, fallback: boolean): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === "1";
    } catch {
      return fallback;
    }
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      /* remembering is only a convenience */
    }
  };
  return [open, toggle];
}

/**
 * Projects in the sidebar. Up to three are listed as they are. With more than three they gather under
 * a Projects heading you open and close. Categories and New project stay on the heading either way.
 */
function SideProjects({ onNewProject, onManage }: { onNewProject(): void; onManage(): void }) {
  const s = useStore();
  const groups = groupProjects(s.data.projects, s.data.categories);
  const folds = s.data.projects.length > 3;
  const [openPref, toggle] = useFold(PROJECTS_OPEN_KEY, false);
  const open = !folds || openPref;
  const actions = (
    <span className="side-label-actions">
      {folds ? (
        <button className="icon-btn on-dark" onClick={onManage} aria-label="Categories" title="Categories"><Tags size={15} /></button>
      ) : (
        <button className="side-text-btn" onClick={onManage}><Tags size={14} />Categories</button>
      )}
      <button className="icon-btn on-dark" onClick={onNewProject} aria-label="New project"><Plus size={16} /></button>
    </span>
  );
  return (
    <>
      {folds ? (
        <div className="side-fold-row">
          <button className="side-link side-fold" aria-expanded={open} onClick={toggle}>
            <FolderKanban size={18} />
            <span className="grow">Projects</span>
            <span className="badge quiet">{s.data.projects.length}</span>
            <ChevronDown size={16} className={"fold-chev" + (open ? " turn" : "")} />
          </button>
          {actions}
        </div>
      ) : (
        <div className="side-label">Projects{actions}</div>
      )}
      {open && (
      <div className="side-projects">
        {groups.map((group) => (
          <div key={group.category?.id ?? "none"} className="side-group">
            {s.data.categories.length > 0 && <div className="side-cat">{group.category?.name ?? "No category"}</div>}
            <div className={"side-group-items" + (s.data.categories.length > 0 ? " nested" : "")}>
              {group.projects.map((p) => {
                const g = s.progress(p.id);
                const on = s.view.kind === "project" && s.view.id === p.id;
                return (
                  <button key={p.id} className={"side-link project" + (on ? " on" : "")} style={tint(p.color)} onClick={() => s.go({ kind: "project", id: p.id })}>
                    <i />
                    <span className="grow">{p.name}</span>
                    <span className="badge quiet">{g.total - g.done}</span>
                  </button>
                );
              })}
              {group.projects.length === 0 && <p className="side-empty">No projects here yet</p>}
            </div>
          </div>
        ))}
        {s.data.projects.length === 0 && <p className="side-empty">No projects yet</p>}
      </div>
      )}
    </>
  );
}

/**
 * Saved filters, so you can jump straight to one. They sit under a Filters heading you can open and close.
 * The heading stays open while one of its filters is showing.
 */
function SavedFilterLinks() {
  const s = useStore();
  const [open, toggle] = useFold(FILTERS_OPEN_KEY, false);
  // A filter saved on a project that has since been deleted has nowhere to open.
  const filters = s.data.savedFilters.filter((f) => f.scope === "all" || s.project(f.scope));
  if (filters.length === 0) return null;
  const current = "filterId" in s.view ? s.view.filterId : undefined;
  const links = filters.map((f) => {
    const project = f.scope === "all" ? undefined : s.project(f.scope);
    return (
      <button
        key={f.id}
        className={"side-link filter" + (current === f.id ? " on" : "")}
        title={project ? `${f.name} (in ${project.name})` : `${f.name} (All tasks)`}
        onClick={() => s.go(project ? { kind: "project", id: project.id, filterId: f.id } : { kind: "all", filterId: f.id })}
      >
        {project ? <i style={{ background: project.color }} /> : <Bookmark size={16} />}
        <span className="grow">{f.name}</span>
      </button>
    );
  });
  const holdsCurrent = filters.some((f) => f.id === current);
  return (
    <div className="side-filters" aria-label="Saved filters">
      <button className="side-link side-fold" aria-expanded={open || holdsCurrent} onClick={toggle}>
        <Bookmark size={18} />
        <span className="grow">Filters</span>
        <span className="badge quiet">{filters.length}</span>
        <ChevronDown size={16} className={"fold-chev" + (open || holdsCurrent ? " turn" : "")} />
      </button>
      {(open || holdsCurrent) && <div className="side-group-items nested">{links}</div>}
    </div>
  );
}

export function MobileNav({ onNewTask }: { onNewTask(): void }) {
  const s = useStore();
  const items: { view: View; label: string; icon: typeof House }[] = [NAV[0], { view: { kind: "projects" }, label: "Projects", icon: FolderKanban }, NAV[1], NAV[2], NAV[3]];
  const active = s.view.kind === "project" ? "projects" : s.view.kind;
  return (
    <nav className="tabs" aria-label="Main">
      {items.slice(0, 2).map(({ view, label, icon: Icon }) => (
        <button key={label} className={active === view.kind ? "on" : ""} onClick={() => s.go(view)}><Icon size={21} />{label}</button>
      ))}
      <button className="fab" onClick={onNewTask} aria-label="New task"><Plus size={24} /></button>
      {items.slice(2).map(({ view, label, icon: Icon }) => (
        <button key={label} className={active === view.kind ? "on" : ""} onClick={() => s.go(view)}><Icon size={21} />{label}</button>
      ))}
    </nav>
  );
}

export function ProjectDialog({ project, onClose }: { project?: Project; onClose(): void }) {
  const s = useStore();
  const [name, setName] = useState(project?.name ?? "");
  const [color, setColor] = useState(project?.color ?? COLORS[s.data.projects.length % COLORS.length]);
  const [defaultPriority, setDefaultPriority] = useState<Priority>(project?.default_priority ?? "medium");
  const [categoryId, setCategoryId] = useState<string>(project?.category_id ?? "");
  const [newCategory, setNewCategory] = useState("");
  // null on the project means it uses the workspace default assignees.
  const [ownDefaults, setOwnDefaults] = useState(project?.default_assignee_ids !== null && project?.default_assignee_ids !== undefined);
  const [assignees, setAssignees] = useState<string[]>(
    project?.default_assignee_ids ?? s.data.workspace.default_assignee_ids,
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const default_assignee_ids = ownDefaults ? assignees : null;
    const category_id = categoryId === NEW_CATEGORY ? (newCategory.trim() ? s.addCategory(newCategory.trim()) : null) : categoryId || null;
    if (project) s.updateProject(project.id, { name: n, color, default_priority: defaultPriority, default_assignee_ids, category_id });
    else s.go({ kind: "project", id: s.addProject(n, color, defaultPriority, category_id) });
    onClose();
  };
  return (
    <Modal title={project ? "Edit project" : "New project"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Kitchen remodel" required /></label>
        <div className="form-field">Color<Swatches value={color} onChange={setColor} colors={COLORS.includes(color) ? COLORS : [color, ...COLORS]} /></div>
        <div className="form-field">
          <label htmlFor="proj-cat">Category</label>
          <select id="proj-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {s.data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value={NEW_CATEGORY}>New category…</option>
          </select>
          {categoryId === NEW_CATEGORY && (
            <input className="new-cat-input" aria-label="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Name the new category, such as Work" maxLength={60} autoFocus />
          )}
          <p className="field-hint">Groups this project under a category in the sidebar. Use Categories in the sidebar to collect several projects at once.</p>
        </div>
        <div className="form-field">
          <label htmlFor="proj-prio">Default priority</label>
          <select id="proj-prio" value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value as Priority)}>
            {PRIORITIES.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
          </select>
          <p className="field-hint">New tasks in this project start with this priority. You can still change it on each task.</p>
        </div>
        <div className="form-field">
          <span>Assigned to by default</span>
          <label className="check-line">
            <input type="checkbox" checked={!ownDefaults} onChange={(e) => setOwnDefaults(!e.target.checked)} />
            Use the workspace default
          </label>
          {ownDefaults && <PeopleDropdown label="Default assignees for this project" value={assignees} onChange={setAssignees} placeholder="Choose who gets new tasks" />}
          <p className="field-hint">{ownDefaults ? "Only these people are assigned to new tasks in this project." : "Uses the people chosen under People → Assigned to by default."}</p>
        </div>
        <div className="form-actions">
          {project && (
            <button
              type="button"
              className="btn quiet danger"
              onClick={() => {
                const n = s.data.tasks.filter((t) => t.project_id === project.id).length;
                if (window.confirm(`Delete "${project.name}" and its ${n} task${n === 1 ? "" : "s"}? This can't be undone.`)) {
                  s.deleteProject(project.id);
                  s.go({ kind: "home" });
                  onClose();
                }
              }}
            >
              Delete project
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>{project ? "Save changes" : "Create project"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function NewTaskDialog({ onClose }: { onClose(): void }) {
  const s = useStore();
  const [title, setTitle] = useState("");
  // Inside a project, new tasks go to that project. Anywhere else they start with no project.
  const [projectId, setProjectId] = useState(s.view.kind === "project" ? s.view.id : "");
  const [due, setDue] = useState("");
  const [mine, setMine] = useState(s.view.kind === "my");
  // People this project assigns new tasks to. If that already includes you, "Assign to me" is not needed.
  const defaults = s.defaultAssigneesFor(projectId || null);
  const meByDefault = !!s.me && defaults.some((p) => p.id === s.me!.id);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const id = s.addTask({ project_id: projectId || null, title: title.trim(), due_date: due || null, assignMe: mine && !meByDefault });
    onClose();
    // Open the new task so its due date, status and priority can be set right away.
    s.openTask(id);
  };
  return (
    <Modal title="New task" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Task<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" required /></label>
        <div className="form-two">
          <label>Project
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {s.data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <div className="form-field">
          <span>Due <small>optional</small></span>
          <DuePicker value={due || null} onChange={(v) => setDue(v ?? "")} />
        </div>
        {defaults.length > 0 && (
          <p className="form-hint">Assigned to {defaults.map((p) => (s.me && p.id === s.me.id ? "you" : p.full_name)).join(", ")} by default.</p>
        )}
        {s.me && !meByDefault && <label className="check-line"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{defaults.length ? "Also assign to me" : "Assign to me"}</label>}
        <div className="form-actions">
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!title.trim()}>Add task</button>
        </div>
      </form>
    </Modal>
  );
}

export function CategoryDialog({ onClose }: { onClose(): void }) {
  const s = useStore();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setCreated(s.addCategory(n));
    setName("");
  };
  const sorted = [...s.data.categories].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Modal title="Categories" onClose={onClose}>
      <form className="form" onSubmit={add}>
        <p className="field-hint">Create a category, then tick the projects that belong in it. A project sits in one category at a time.</p>
        <div className="form-inline">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, such as Work" aria-label="New category name" maxLength={60} />
          <button className="btn primary" type="submit" disabled={!name.trim()}>Add category</button>
        </div>
      </form>
      {sorted.length === 0 ? (
        <p className="field-hint">No categories yet.</p>
      ) : (
        <div className="cat-list">
          {sorted.map((c) => <CategoryRow key={c.id} category={c} startOpen={created === c.id} />)}
        </div>
      )}
      <div className="form-actions">
        <span className="grow" />
        <button type="button" className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

function CategoryRow({ category, startOpen }: { category: Category; startOpen: boolean }) {
  const s = useStore();
  const [name, setName] = useState(category.name);
  const [open, setOpen] = useState(startOpen);
  const members = s.data.projects.filter((p) => p.category_id === category.id).length;
  const commit = () => {
    const n = name.trim();
    if (!n) setName(category.name);
    else if (n !== category.name) s.renameCategory(category.id, n);
  };
  return (
    <div className="cat-item">
      <div className="cat-row">
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label={`Name for ${category.name}`} maxLength={60} />
        <button type="button" className="btn small" aria-expanded={open} onClick={() => setOpen(!open)}>
          {members} project{members === 1 ? "" : "s"}
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Delete ${category.name}`}
          onClick={() => {
            if (window.confirm(`Delete the category "${category.name}"? Its projects stay, but move out of it.`)) s.deleteCategory(category.id);
          }}
        >
          <X size={16} />
        </button>
      </div>
      {open && (
        <div className="cat-projects">
          {s.data.projects.length === 0 && <p className="field-hint">Create a project first, then add it here.</p>}
          {s.data.projects.map((p) => {
            const inThis = p.category_id === category.id;
            const other = p.category_id && !inThis ? s.data.categories.find((c) => c.id === p.category_id)?.name : null;
            return (
              <label key={p.id} className="check-line">
                <input type="checkbox" checked={inThis} onChange={(e) => s.updateProject(p.id, { category_id: e.target.checked ? category.id : null })} />
                <span className="cat-project-name"><i style={{ background: p.color }} />{p.name}</span>
                {other && <small>in {other}</small>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
