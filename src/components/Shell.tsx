import { useState, type FormEvent } from "react";
import { CircleCheck, FolderKanban, House, LogOut, Plus, Users } from "lucide-react";
import { useStore } from "../lib/store";
import type { Project, View } from "../lib/types";
import { COLORS, tint } from "../lib/util";
import { Avatar, Modal, Swatches } from "./ui";

const NAV: { view: View; label: string; icon: typeof House }[] = [
  { view: { kind: "home" }, label: "Home", icon: House },
  { view: { kind: "my" }, label: "My tasks", icon: CircleCheck },
  { view: { kind: "people" }, label: "People", icon: Users },
];

export function Sidebar({ onNewProject, onSignOut }: { onNewProject(): void; onSignOut?: () => void }) {
  const s = useStore();
  const myOpen = s.me ? s.tasksFor(s.me.id).filter((t) => t.status !== "done").length : 0;
  return (
    <nav className="side" aria-label="Main">
      <div className="brand"><span className="brand-mark" />Task Manager</div>
      <div className="side-nav">
        {NAV.map(({ view, label, icon: Icon }) => (
          <button key={label} className={"side-link" + (s.view.kind === view.kind ? " on" : "")} onClick={() => s.go(view)}>
            <Icon size={18} />{label}
            {view.kind === "my" && myOpen > 0 && <span className="badge">{myOpen}</span>}
          </button>
        ))}
      </div>

      <div className="side-label">
        Projects
        <button className="icon-btn on-dark" onClick={onNewProject} aria-label="New project"><Plus size={16} /></button>
      </div>
      <div className="side-projects">
        {s.data.projects.map((p) => {
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
        {s.data.projects.length === 0 && <p className="side-empty">No projects yet</p>}
      </div>

      <div className="side-foot">
        {s.me && <Avatar person={s.me} size={30} />}
        <span className="grow who">{s.me?.full_name ?? s.data.email}{s.api.demo && <small>Sample data, nothing is saved</small>}</span>
        {onSignOut && <button className="icon-btn on-dark" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>}
      </div>
    </nav>
  );
}

export function MobileNav({ onNewTask }: { onNewTask(): void }) {
  const s = useStore();
  const items: { view: View; label: string; icon: typeof House }[] = [NAV[0], { view: { kind: "projects" }, label: "Projects", icon: FolderKanban }, NAV[1], NAV[2]];
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
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (project) s.updateProject(project.id, { name: n, color });
    else s.go({ kind: "project", id: s.addProject(n, color) });
    onClose();
  };
  return (
    <Modal title={project ? "Edit project" : "New project"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Kitchen remodel" required /></label>
        <div className="form-field">Color<Swatches value={color} onChange={setColor} colors={COLORS.includes(color) ? COLORS : [color, ...COLORS]} /></div>
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
  const [projectId, setProjectId] = useState(s.view.kind === "project" ? s.view.id : (s.data.projects[0]?.id ?? ""));
  const [due, setDue] = useState("");
  const [mine, setMine] = useState(s.view.kind === "my");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    s.addTask({ project_id: projectId, title: title.trim(), due_date: due || null, assignMe: mine });
    onClose();
  };
  return (
    <Modal title="New task" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Task<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" required /></label>
        <div className="form-two">
          <label>Project
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              {s.data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Due <small>optional</small><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        </div>
        {s.me && <label className="check-line"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Assign to me</label>}
        {s.data.projects.length === 0 && <p className="form-hint">Create a project first, then add tasks to it.</p>}
        <div className="form-actions">
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!title.trim() || !projectId}>Add task</button>
        </div>
      </form>
    </Modal>
  );
}
