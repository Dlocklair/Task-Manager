import { useCallback, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, Kanban, List, Plus, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PriorityKey, Project, QuickFilter, StatusKey, Task, ViewState } from "./types";
import { PRIORITIES, priorityDef } from "./constants";
import { newTask, parseData, useAppData } from "./store";
import { emptyData, sampleData } from "./sample";
import { daysFromToday, longToday, plural, uid } from "./utils";
import { Sidebar } from "./components/Sidebar";
import { Board } from "./components/Board";
import { ListView } from "./components/ListView";
import { TaskDetail } from "./components/TaskDetail";
import { AddTaskDialog } from "./components/AddTaskDialog";
import type { NewTaskInput } from "./components/AddTaskDialog";
import { ProjectDialog } from "./components/ProjectDialog";
import { Dialog } from "./components/Dialog";
import { PriorityBars } from "./components/bits";

type DialogState =
  | { kind: "addTask"; status?: StatusKey }
  | { kind: "project"; project?: Project }
  | { kind: "reset" }
  | { kind: "export" }
  | null;

interface Toast {
  text: string;
  undo?: () => void;
}

const QUICK: { key: Exclude<QuickFilter, null>; label: string; hsl: string; text: string; Icon: LucideIcon; test: (t: Task) => boolean }[] = [
  { key: "overdue", label: "Overdue", hsl: "0 84% 60%", text: "hsl(0 84% 68%)", Icon: AlertTriangle, test: (t) => t.status !== "done" && !!t.due && daysFromToday(t.due) < 0 },
  { key: "today", label: "Due today", hsl: "38 92% 50%", text: "hsl(38 92% 58%)", Icon: Clock, test: (t) => t.status !== "done" && !!t.due && daysFromToday(t.due) === 0 },
  { key: "progress", label: "In progress", hsl: "210 90% 62%", text: "hsl(210 90% 66%)", Icon: Activity, test: (t) => t.status === "progress" },
  { key: "done", label: "Completed", hsl: "150 60% 45%", text: "hsl(150 60% 52%)", Icon: CheckCircle2, test: (t) => t.status === "done" },
];

/** Embedded previews (e.g. a shared link viewer) block file downloads, so only offer Copy there. */
const inFrame = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

export default function App() {
  const [data, dispatch] = useAppData();
  const [vs, setVs] = useState<ViewState>({ projectId: null, quick: null, priority: null, query: "", view: "board", selectedTaskId: null });
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const set = (patch: Partial<ViewState>) => setVs((v) => ({ ...v, ...patch }));

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 6000);
  }, []);

  const { projects, tasks } = data;
  const selectedProject = projects.find((p) => p.id === vs.projectId);
  /** New tasks go into the selected project; with "All projects" open, the last project used (or the first). */
  const defaultProject = selectedProject ?? projects.find((p) => p.id === lastProjectId) ?? projects[0];

  const scoped = useMemo(() => (vs.projectId ? tasks.filter((t) => t.projectId === vs.projectId) : tasks), [tasks, vs.projectId]);

  const visible = useMemo(() => {
    const q = vs.query.trim().toLowerCase();
    const quick = QUICK.find((x) => x.key === vs.quick);
    return scoped
      .filter((t) => (quick ? quick.test(t) : true))
      .filter((t) => (vs.priority ? t.priority === vs.priority : true))
      .filter((t) => {
        if (!q) return true;
        const pName = projects.find((p) => p.id === t.projectId)?.name ?? "";
        return [t.title, t.description, t.owner, pName, ...t.subtasks.map((s) => s.title), ...t.notes.map((n) => n.text)]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const pa = priorityDef(a.priority).level, pb = priorityDef(b.priority).level;
        if (pa !== pb) return pb - pa;
        const da = a.due ? daysFromToday(a.due) : 1e9, db = b.due ? daysFromToday(b.due) : 1e9;
        return da - db || b.createdAt - a.createdAt;
      });
  }, [scoped, vs.quick, vs.priority, vs.query, projects]);

  const selectedTask = tasks.find((t) => t.id === vs.selectedTaskId) ?? null;
  const anyFilter = !!(vs.quick || vs.priority || vs.query.trim());

  const createTask = (input: NewTaskInput) => {
    const task = newTask(input);
    task.subtasks = input.subtasks.map((title) => ({ id: uid(), title, done: false }));
    dispatch({ type: "addTask", task });
    setLastProjectId(input.projectId);
    set({ selectedTaskId: task.id, quick: null, priority: null, query: "" });
    setDialog(null);
    const pName = projects.find((p) => p.id === input.projectId)?.name;
    showToast({ text: `Added “${task.title}” to ${pName}` });
  };

  const quickAdd = (title: string, status: StatusKey) => {
    if (!defaultProject) {
      setDialog({ kind: "project" });
      return;
    }
    const task = newTask({ title, status, projectId: defaultProject.id });
    dispatch({ type: "addTask", task });
    setLastProjectId(defaultProject.id);
    set({ selectedTaskId: task.id });
  };

  const deleteTask = (task: Task) => {
    dispatch({ type: "deleteTask", id: task.id });
    set({ selectedTaskId: null });
    showToast({ text: `Deleted “${task.title}”`, undo: () => dispatch({ type: "addTask", task }) });
  };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importData = (file: File) => {
    file.text().then((txt) => {
      const d = parseData(txt);
      if (!d) {
        showToast({ text: "That file isn’t a Task Manager backup." });
        return;
      }
      const prev = data;
      dispatch({ type: "replaceAll", data: d });
      set({ projectId: null, selectedTaskId: null });
      showToast({ text: `Imported ${plural(d.tasks.length, "task")} in ${plural(d.projects.length, "project")}`, undo: () => dispatch({ type: "replaceAll", data: prev }) });
    });
  };

  const openCount = scoped.filter((t) => t.status !== "done").length;

  return (
    <div className="shell">
      <Sidebar
        projects={projects}
        tasks={tasks}
        selectedProjectId={vs.projectId}
        onSelectProject={(id) => set({ projectId: id, selectedTaskId: null })}
        onNewProject={() => setDialog({ kind: "project" })}
        onEditProject={(p) => setDialog({ kind: "project", project: p })}
        onExport={() => setDialog({ kind: "export" })}
        onImport={importData}
        onReset={() => setDialog({ kind: "reset" })}
      />

      <main className="main">
        <header className="page-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="meta" style={{ fontWeight: 500 }}>{longToday()}</span>
            <h1 className="page-title">
              {selectedProject && <span className="project-swatch" style={{ width: 16, height: 16, borderRadius: 4, background: `hsl(${selectedProject.color})` }} />}
              {selectedProject ? selectedProject.name : "All projects"}
            </h1>
            <span className="meta">
              {plural(openCount, "open task")}
              {selectedProject ? " · New tasks are added to this project" : ` across ${plural(projects.length, "project")}`}
            </span>
          </div>
          <div className="head-actions">
            <div className="search">
              <Search size={16} aria-hidden="true" />
              <label className="sr-only" htmlFor="search">Search tasks</label>
              <input id="search" type="search" className="input" placeholder="Search tasks, subtasks, notes" value={vs.query} onChange={(e) => set({ query: e.target.value })} />
            </div>
            <button type="button" className="btn btn-primary" onClick={() => (projects.length ? setDialog({ kind: "addTask" }) : setDialog({ kind: "project" }))}>
              <Plus size={16} aria-hidden="true" />Add Task
            </button>
          </div>
        </header>

        <section className="stats" aria-label="Summary — select a tile to filter">
          {QUICK.map((q) => {
            const on = vs.quick === q.key;
            return (
              <button
                key={q.key}
                type="button"
                className={"stat" + (on ? " active" : "")}
                aria-pressed={on}
                style={on ? { borderColor: `hsl(${q.hsl})` } : undefined}
                onClick={() => set({ quick: on ? null : q.key })}
              >
                <span className="stat-icon" style={{ background: `hsl(${q.hsl} / 0.15)`, color: q.text }}>
                  <q.Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="stat-num">{scoped.filter(q.test).length}</span>
                  <span className="stat-label" style={{ color: q.text }}>{q.label}</span>
                </span>
              </button>
            );
          })}
        </section>

        <div className="toolbar">
          <div className="segmented" role="group" aria-label="View">
            <button type="button" aria-pressed={vs.view === "board"} onClick={() => set({ view: "board" })}><Kanban size={16} aria-hidden="true" />Board</button>
            <button type="button" aria-pressed={vs.view === "list"} onClick={() => set({ view: "list" })}><List size={16} aria-hidden="true" />List</button>
          </div>
          <div className="chips">
            <span className="meta" style={{ fontWeight: 500, marginRight: 4 }}>Priority</span>
            {PRIORITIES.map((p) => {
              const on = vs.priority === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() => set({ priority: on ? null : (p.key as PriorityKey) })}
                  style={on ? { background: p.bg, borderColor: p.text, color: p.text } : undefined}
                >
                  <PriorityBars priority={p.key} />
                  {p.label}
                </button>
              );
            })}
            {anyFilter && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ quick: null, priority: null, query: "" })}>
                <X size={14} aria-hidden="true" />Clear filters
              </button>
            )}
          </div>
        </div>
        {anyFilter && <p className="meta filter-note">Showing {visible.length} of {scoped.length} tasks</p>}

        <div className="content">
          <div className="content-main">
            {projects.length === 0 ? (
              <div className="detail-empty" style={{ border: "1px dashed hsl(var(--border))", borderRadius: 8 }}>
                <strong>Step 1: Create a project</strong>
                <span className="meta">Projects group your tasks. Create one, then add tasks and subtasks to it.</span>
                <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setDialog({ kind: "project" })}>
                  <Plus size={16} aria-hidden="true" />New project
                </button>
              </div>
            ) : vs.view === "board" ? (
              <Board
                tasks={visible}
                projects={projects}
                selectedTaskId={vs.selectedTaskId}
                showProject={!selectedProject}
                quickAddProject={defaultProject}
                onSelect={(id) => set({ selectedTaskId: id })}
                onMove={(id, status) => dispatch({ type: "setStatus", id, status })}
                onQuickAdd={quickAdd}
              />
            ) : (
              <ListView tasks={visible} projects={projects} selectedTaskId={vs.selectedTaskId} onSelect={(id) => set({ selectedTaskId: id })} />
            )}
          </div>

          {selectedTask ? (
            <TaskDetail
              key={selectedTask.id}
              task={selectedTask}
              projects={projects}
              dispatch={dispatch}
              onClose={() => set({ selectedTaskId: null })}
              onDelete={() => deleteTask(selectedTask)}
            />
          ) : null}
        </div>
      </main>

      {dialog?.kind === "addTask" && (
        <AddTaskDialog projects={projects} defaultProjectId={selectedProject?.id ?? null} defaultStatus={dialog.status} onCreate={createTask} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "project" && (
        <ProjectDialog
          project={dialog.project}
          taskCount={dialog.project ? tasks.filter((t) => t.projectId === dialog.project!.id).length : 0}
          onClose={() => setDialog(null)}
          onSave={(name, color) => {
            if (dialog.project) {
              dispatch({ type: "updateProject", id: dialog.project.id, patch: { name, color } });
            } else {
              const project: Project = { id: uid(), name, color, createdAt: Date.now() };
              dispatch({ type: "addProject", project });
              set({ projectId: project.id, selectedTaskId: null });
            }
            setDialog(null);
          }}
          onDelete={
            dialog.project
              ? () => {
                  const id = dialog.project!.id;
                  dispatch({ type: "deleteProject", id });
                  if (vs.projectId === id) set({ projectId: null });
                  if (selectedTask?.projectId === id) set({ selectedTaskId: null });
                  setDialog(null);
                }
              : undefined
          }
        />
      )}
      {dialog?.kind === "export" && (
        <Dialog title="Export backup" onClose={() => setDialog(null)}>
          <p className="muted" style={{ margin: 0 }}>Copy this text and save it somewhere safe. Use Import backup to restore it later or move your tasks to another browser.</p>
          <textarea className="textarea" readOnly aria-label="Backup data" value={JSON.stringify(data, null, 2)} style={{ minHeight: 180, fontFamily: "ui-monospace, monospace", fontSize: 12 }} onFocus={(e) => e.target.select()} />
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Close</button>
            {!inFrame && <button type="button" className="btn btn-outline" onClick={downloadBackup}>Download file</button>}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(JSON.stringify(data, null, 2))
                  .then(() => showToast({ text: "Backup copied to clipboard" }))
                  .catch(() => showToast({ text: "Couldn’t copy — select the text and copy it manually." }));
              }}
            >
              Copy backup
            </button>
          </div>
        </Dialog>
      )}
      {dialog?.kind === "reset" && (
        <Dialog title="Reset workspace" onClose={() => setDialog(null)}>
          <p className="muted" style={{ margin: 0 }}>This replaces everything saved in this browser. Export a backup first if you want to keep your current tasks.</p>
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-outline" onClick={() => { const prev = data; dispatch({ type: "replaceAll", data: emptyData() }); set({ projectId: null, selectedTaskId: null }); setDialog(null); showToast({ text: "Started an empty workspace", undo: () => dispatch({ type: "replaceAll", data: prev }) }); }}>
              Start empty
            </button>
            <button type="button" className="btn btn-primary" onClick={() => { const prev = data; dispatch({ type: "replaceAll", data: sampleData() }); set({ projectId: null, selectedTaskId: null }); setDialog(null); showToast({ text: "Loaded sample data", undo: () => dispatch({ type: "replaceAll", data: prev }) }); }}>
              Load sample data
            </button>
          </div>
        </Dialog>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: "hsl(var(--primary-text))" }} onClick={() => { toast.undo!(); setToast(null); }}>
              Undo
            </button>
          )}
          <button type="button" className="tiny-btn" onClick={() => setToast(null)} aria-label="Dismiss"><X size={14} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}
