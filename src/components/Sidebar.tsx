import { useRef } from "react";
import { Download, LayoutGrid, ListChecks, Pencil, Plus, RotateCcw, Upload } from "lucide-react";
import type { Project, Task } from "../types";

interface Props {
  projects: Project[];
  tasks: Task[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onNewProject: () => void;
  onEditProject: (p: Project) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

export function Sidebar(props: Props) {
  const { projects, tasks, selectedProjectId, onSelectProject } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const openCount = (projectId?: string) =>
    tasks.filter((t) => t.status !== "done" && (!projectId || t.projectId === projectId)).length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <aside className="sidebar" aria-label="Projects">
      <div className="brand">
        <span className="brand-mark"><ListChecks size={16} strokeWidth={2.5} aria-hidden="true" /></span>
        <span className="brand-name">Task Manager</span>
      </div>

      <nav aria-label="Views">
        <button
          type="button"
          className={"nav-item" + (selectedProjectId === null ? " active" : "")}
          aria-current={selectedProjectId === null ? "page" : undefined}
          onClick={() => onSelectProject(null)}
        >
          <LayoutGrid size={20} aria-hidden="true" />
          <span className="grow">All projects</span>
          <span className="count">{openCount()}</span>
        </button>
      </nav>

      <div>
        <div className="section-label">
          <span>Projects</span>
          <button type="button" className="tiny-btn" onClick={props.onNewProject} aria-label="New project" title="New project">
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {projects.map((p) => {
            const active = selectedProjectId === p.id;
            return (
              <div className="project-row" key={p.id}>
                <button
                  type="button"
                  className={"nav-item" + (active ? " active" : "")}
                  aria-current={active ? "page" : undefined}
                  style={active ? { background: `hsl(${p.color} / 0.14)`, color: "hsl(var(--foreground))" } : undefined}
                  onClick={() => onSelectProject(p.id)}
                >
                  <span className="project-swatch" style={{ background: `hsl(${p.color})` }} />
                  <span className="grow">{p.name}</span>
                  <span className="count">{openCount(p.id)}</span>
                </button>
                <button type="button" className="tiny-btn edit-btn" onClick={() => props.onEditProject(p)} aria-label={`Edit ${p.name}`} title="Edit project">
                  <Pencil size={14} aria-hidden="true" />
                </button>
              </div>
            );
          })}
          <button type="button" className="nav-item" onClick={props.onNewProject}>
            <Plus size={16} aria-hidden="true" style={{ marginLeft: -2 }} />
            <span className="grow">New project</span>
          </button>
        </div>
      </div>

      <div className="week-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Overall progress</span>
          <span className="meta">{pct}%</span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tasks complete">
          <div style={{ width: pct + "%" }} />
        </div>
        <span className="meta">{done} of {tasks.length} tasks complete</span>
      </div>

      <div>
        <div className="section-label"><span>Your data</span></div>
        <button type="button" className="nav-item" onClick={props.onExport}>
          <Download size={16} aria-hidden="true" /><span className="grow">Export backup</span>
        </button>
        <button type="button" className="nav-item" onClick={() => fileRef.current?.click()}>
          <Upload size={16} aria-hidden="true" /><span className="grow">Import backup</span>
        </button>
        <button type="button" className="nav-item" onClick={props.onReset}>
          <RotateCcw size={16} aria-hidden="true" /><span className="grow">Reset workspace</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onImport(f);
            e.target.value = "";
          }}
        />
        <p className="meta" style={{ margin: "8px 12px 0" }}>Saved in this browser automatically.</p>
      </div>
    </aside>
  );
}
