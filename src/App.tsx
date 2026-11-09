import { useCallback, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDownWideNarrow, ArrowUpNarrowWide, BookmarkPlus, CheckCircle2, Clock, Kanban, List, Plus, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Filters, Project, SavedView, SortKey, StatusKey, Task } from "./types";
import { DEFAULT_FILTERS, DUE_OPTIONS, PRIORITIES, SORT_OPTIONS, STATUS_FILTER_OPTIONS } from "./constants";
import { newTask, parseData, useAppData } from "./store";
import { emptyData, sampleData } from "./sample";
import { describeFilters, filtersEqual, hasActiveFilters, matchesFilters, sortTasks } from "./filters";
import { longToday, plural, uid } from "./utils";
import { Sidebar } from "./components/Sidebar";
import { Board } from "./components/Board";
import { ListView } from "./components/ListView";
import { TaskDetail } from "./components/TaskDetail";
import { AddTaskDialog } from "./components/AddTaskDialog";
import type { NewTaskInput } from "./components/AddTaskDialog";
import { ProjectDialog } from "./components/ProjectDialog";
import { SavedViewDialog } from "./components/SavedViewDialog";
import { Dialog } from "./components/Dialog";
import { PriorityBars } from "./components/bits";

type DialogState =
  | { kind: "addTask"; status?: StatusKey }
  | { kind: "project"; project?: Project }
  | { kind: "savedView"; view?: SavedView }
  | { kind: "reset" }
  | { kind: "export" }
  | null;

interface Toast {
  text: string;
  undo?: () => void;
}

/** Summary tiles: each one sets the due-date or status filter, so they combine with priority and project. */
const TILES: { id: string; label: string; hsl: string; text: string; Icon: LucideIcon; patch: Partial<Filters>; isOn: (f: Filters) => boolean }[] = [
  { id: "overdue", label: "Overdue", hsl: "0 84% 60%", text: "hsl(0 84% 68%)", Icon: AlertTriangle, patch: { due: "overdue" }, isOn: (f) => f.due === "overdue" },
  { id: "today", label: "Due today", hsl: "38 92% 50%", text: "hsl(38 92% 58%)", Icon: Clock, patch: { due: "today" }, isOn: (f) => f.due === "today" },
  { id: "progress", label: "In progress", hsl: "210 90% 62%", text: "hsl(210 90% 66%)", Icon: Activity, patch: { status: "progress" }, isOn: (f) => f.status === "progress" },
  { id: "done", label: "Completed", hsl: "150 60% 45%", text: "hsl(150 60% 52%)", Icon: CheckCircle2, patch: { status: "done" }, isOn: (f) => f.status === "done" },
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
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<"board" | "list">("board");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [appliedViewId, setAppliedViewId] = useState<string | null>(null);
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 6000);
  }, []);

  const { projects, tasks, savedViews } = data;
  const selectedProject = projects.find((p) => p.id === filters.projectId);
  /** New tasks go into the selected project; with "All projects" open, the last project used (or the first). */
  const defaultProject = selectedProject ?? projects.find((p) => p.id === lastProjectId) ?? projects[0];

  const scoped = useMemo(() => (filters.projectId ? tasks.filter((t) => t.projectId === filters.projectId) : tasks), [tasks, filters.projectId]);
  const visible = useMemo(
    () => sortTasks(tasks.filter((t) => matchesFilters(t, filters, projects)), filters.sort, filters.dir, projects),
    [tasks, filters, projects],
  );

  const appliedView = savedViews.find((v) => v.id === appliedViewId) ?? null;
  const activeView =
    (appliedView && filtersEqual(appliedView.filters, filters) ? appliedView : savedViews.find((v) => filtersEqual(v.filters, filters))) ?? null;
  const viewModified = !!appliedView && !activeView;
  const narrowing = hasActiveFilters(filters);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const applyView = (v: SavedView) => {
    setFilters({ ...DEFAULT_FILTERS, ...v.filters, projectId: projects.some((p) => p.id === v.filters.projectId) ? v.filters.projectId : null });
    setAppliedViewId(v.id);
    setSelectedTaskId(null);
  };

  const setSort = (key: SortKey) =>
    setFilters((f) => (f.sort === key ? { ...f, dir: f.dir === "asc" ? "desc" : "asc" } : { ...f, sort: key, dir: "asc" }));

  const createTask = (input: NewTaskInput) => {
    const task = newTask(input, tasks);
    task.subtasks = input.subtasks.map((title) => ({ id: uid(), title, done: false }));
    dispatch({ type: "addTask", task });
    setLastProjectId(input.projectId);
    // Make sure the new task is visible: keep the project, drop the narrowing filters.
    if (!matchesFilters(task, filters, projects)) setFilters((f) => ({ ...DEFAULT_FILTERS, projectId: f.projectId, sort: f.sort, dir: f.dir }));
    setSelectedTaskId(task.id);
    setDialog(null);
    const pName = projects.find((p) => p.id === input.projectId)?.name;
    showToast({ text: `Added “${task.title}” to ${pName}` });
  };

  const quickAdd = (title: string, status: StatusKey) => {
    if (!defaultProject) {
      setDialog({ kind: "project" });
      return;
    }
    const task = newTask({ title, status, projectId: defaultProject.id }, tasks);
    dispatch({ type: "addTask", task });
    setLastProjectId(defaultProject.id);
    if (!matchesFilters(task, filters, projects)) setFilters((f) => ({ ...DEFAULT_FILTERS, projectId: f.projectId, sort: f.sort, dir: f.dir }));
    setSelectedTaskId(task.id);
  };

  const deleteTask = (task: Task) => {
    dispatch({ type: "deleteTask", id: task.id });
    setSelectedTaskId(null);
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
      setFilters(DEFAULT_FILTERS);
      setSelectedTaskId(null);
      showToast({ text: `Imported ${plural(d.tasks.length, "task")} in ${plural(d.projects.length, "project")}`, undo: () => dispatch({ type: "replaceAll", data: prev }) });
    });
  };

  const resetTo = (next: typeof data, text: string) => {
    const prev = data;
    dispatch({ type: "replaceAll", data: next });
    setFilters(DEFAULT_FILTERS);
    setSelectedTaskId(null);
    setAppliedViewId(null);
    setDialog(null);
    showToast({ text, undo: () => dispatch({ type: "replaceAll", data: prev }) });
  };

  const openCount = scoped.filter((t) => t.status !== "done").length;
  const heading = activeView ? activeView.name : selectedProject ? selectedProject.name : "All projects";

  return (
    <div className="shell">
      <Sidebar
        projects={projects}
        tasks={tasks}
        selectedProjectId={filters.projectId}
        onSelectProject={(id) => { patch({ projectId: id }); setSelectedTaskId(null); setAppliedViewId(null); }}
        savedViews={savedViews}
        activeViewId={activeView?.id ?? null}
        viewCount={(v) => tasks.filter((t) => matchesFilters(t, v.filters, projects)).length}
        onApplyView={applyView}
        onEditView={(v) => setDialog({ kind: "savedView", view: v })}
        onSaveView={() => setDialog({ kind: "savedView" })}
        onNewProject={() => setDialog({ kind: "project" })}
        onEditProject={(p) => setDialog({ kind: "project", project: p })}
        onExport={() => setDialog({ kind: "export" })}
        onImport={importData}
        onReset={() => setDialog({ kind: "reset" })}
      />

      <main className="main">
        <header className="page-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span className="meta" style={{ fontWeight: 500 }}>{longToday()}</span>
            <h1 className="page-title">
              {!activeView && selectedProject && <span className="project-swatch" style={{ width: 16, height: 16, borderRadius: 4, background: `hsl(${selectedProject.color})` }} />}
              {heading}
            </h1>
            <span className="meta">
              {activeView || narrowing
                ? describeFilters(filters, projects)
                : selectedProject
                  ? `${plural(openCount, "open task")} · New tasks are added to this project`
                  : `${plural(openCount, "open task")} across ${plural(projects.length, "project")}`}
            </span>
          </div>
          <div className="head-actions">
            <div className="search">
              <Search size={16} aria-hidden="true" />
              <label className="sr-only" htmlFor="search">Search tasks</label>
              <input id="search" type="search" className="input" placeholder="Search tasks, subtasks, notes" value={filters.query} onChange={(e) => patch({ query: e.target.value })} />
            </div>
            <button type="button" className="btn btn-primary" onClick={() => (projects.length ? setDialog({ kind: "addTask" }) : setDialog({ kind: "project" }))}>
              <Plus size={16} aria-hidden="true" />Add Task
            </button>
          </div>
        </header>

        <section className="stats" aria-label="Summary — select a tile to filter">
          {TILES.map((q) => {
            const on = q.isOn(filters);
            const count = scoped.filter((t) => matchesFilters(t, { ...DEFAULT_FILTERS, projectId: filters.projectId, ...q.patch }, projects)).length;
            return (
              <button
                key={q.id}
                type="button"
                className={"stat" + (on ? " active" : "")}
                aria-pressed={on}
                style={on ? { borderColor: `hsl(${q.hsl})` } : undefined}
                onClick={() => {
                  if (on) patch(q.patch.due ? { due: "any" } : { status: "any" });
                  else patch(q.patch);
                }}
              >
                <span className="stat-icon" style={{ background: `hsl(${q.hsl} / 0.15)`, color: q.text }}>
                  <q.Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="stat-num">{count}</span>
                  <span className="stat-label" style={{ color: q.text }}>{q.label}</span>
                </span>
              </button>
            );
          })}
        </section>

        <div className="toolbar">
          <div className="toolbar-row">
            <div className="segmented" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}><Kanban size={16} aria-hidden="true" />Board</button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={16} aria-hidden="true" />List</button>
            </div>
            <div className="toolbar-group">
              <label className="meta" htmlFor="sort" style={{ fontWeight: 500 }}>Sort by</label>
              <select id="sort" className="select select-sm" value={filters.sort} onChange={(e) => patch({ sort: e.target.value as SortKey, dir: "asc" })}>
                {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <button
                type="button"
                className="btn btn-outline btn-icon"
                onClick={() => patch({ dir: filters.dir === "asc" ? "desc" : "asc" })}
                aria-label={filters.dir === "asc" ? "Sort order: normal. Select to reverse." : "Sort order: reversed. Select to restore."}
                title="Reverse sort order"
              >
                {filters.dir === "asc" ? <ArrowDownWideNarrow size={16} aria-hidden="true" /> : <ArrowUpNarrowWide size={16} aria-hidden="true" />}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setDialog({ kind: "savedView" })}>
                <BookmarkPlus size={15} aria-hidden="true" />Save view
              </button>
            </div>
          </div>
          <div className="toolbar-row">
            <div className="chips" role="group" aria-label="Priority filter">
              <span className="meta" style={{ fontWeight: 500, marginRight: 4 }}>Priority</span>
              {PRIORITIES.map((p) => {
                const on = filters.priorities.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() => patch({ priorities: on ? filters.priorities.filter((x) => x !== p.key) : [...filters.priorities, p.key] })}
                    style={on ? { background: p.bg, borderColor: p.text, color: p.text } : undefined}
                  >
                    <PriorityBars priority={p.key} />
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="toolbar-group">
              <label className="sr-only" htmlFor="f-due">Due date filter</label>
              <select id="f-due" className={"select select-sm" + (filters.due !== "any" ? " is-set" : "")} value={filters.due} onChange={(e) => patch({ due: e.target.value as Filters["due"] })}>
                {DUE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <label className="sr-only" htmlFor="f-status">Status filter</label>
              <select id="f-status" className={"select select-sm" + (filters.status !== "any" ? " is-set" : "")} value={filters.status} onChange={(e) => patch({ status: e.target.value as Filters["status"] })}>
                {STATUS_FILTER_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              {narrowing && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFilters((f) => ({ ...DEFAULT_FILTERS, projectId: f.projectId, sort: f.sort, dir: f.dir })); setAppliedViewId(null); }}>
                  <X size={14} aria-hidden="true" />Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {(narrowing || viewModified) && (
          <p className="meta filter-note">
            Showing {visible.length} of {scoped.length} tasks
            {viewModified && appliedView && (
              <>
                {" · "}Changed from “{appliedView.name}”{" "}
                <button type="button" className="link-btn" onClick={() => { dispatch({ type: "updateSavedView", id: appliedView.id, patch: { filters } }); showToast({ text: `Updated “${appliedView.name}”` }); }}>
                  Update view
                </button>
                {" · "}
                <button type="button" className="link-btn" onClick={() => applyView(appliedView)}>Revert</button>
              </>
            )}
          </p>
        )}

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
            ) : view === "board" ? (
              <Board
                tasks={visible}
                projects={projects}
                selectedTaskId={selectedTaskId}
                showProject={!selectedProject}
                sort={filters.sort}
                quickAddProject={defaultProject}
                onSelect={setSelectedTaskId}
                onMove={(id, status) => dispatch({ type: "setStatus", id, status })}
                onReorder={(id, targetId, place) => dispatch({ type: "reorder", id, targetId, place })}
                onQuickAdd={quickAdd}
              />
            ) : (
              <ListView
                tasks={visible}
                projects={projects}
                selectedTaskId={selectedTaskId}
                sort={filters.sort}
                dir={filters.dir}
                onSort={setSort}
                onSelect={setSelectedTaskId}
                onStatus={(id, status) => dispatch({ type: "setStatus", id, status })}
                onReorder={(id, targetId, place) => dispatch({ type: "reorder", id, targetId, place })}
              />
            )}
          </div>

          {selectedTask ? (
            <TaskDetail
              key={selectedTask.id}
              task={selectedTask}
              projects={projects}
              dispatch={dispatch}
              onClose={() => setSelectedTaskId(null)}
              onDelete={() => deleteTask(selectedTask)}
            />
          ) : null}
        </div>
      </main>

      {dialog?.kind === "addTask" && (
        <AddTaskDialog projects={projects} defaultProjectId={selectedProject?.id ?? null} defaultStatus={dialog.status} onCreate={createTask} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "savedView" && (
        <SavedViewDialog
          view={dialog.view}
          current={filters}
          projects={projects}
          onClose={() => setDialog(null)}
          onSave={(name, f) => {
            if (dialog.view) {
              dispatch({ type: "updateSavedView", id: dialog.view.id, patch: { name, filters: f } });
              showToast({ text: `Updated “${name}”` });
            } else {
              const v: SavedView = { id: uid(), name, filters: f, createdAt: Date.now() };
              dispatch({ type: "addSavedView", view: v });
              setAppliedViewId(v.id);
              showToast({ text: `Saved “${name}” — find it in the sidebar` });
            }
            setDialog(null);
          }}
          onDelete={
            dialog.view
              ? () => {
                  const v = dialog.view!;
                  dispatch({ type: "deleteSavedView", id: v.id });
                  if (appliedViewId === v.id) setAppliedViewId(null);
                  setDialog(null);
                  showToast({ text: `Deleted “${v.name}”`, undo: () => dispatch({ type: "addSavedView", view: v }) });
                }
              : undefined
          }
        />
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
              patch({ projectId: project.id });
              setSelectedTaskId(null);
            }
            setDialog(null);
          }}
          onDelete={
            dialog.project
              ? () => {
                  const id = dialog.project!.id;
                  dispatch({ type: "deleteProject", id });
                  if (filters.projectId === id) patch({ projectId: null });
                  if (selectedTask?.projectId === id) setSelectedTaskId(null);
                  setDialog(null);
                }
              : undefined
          }
        />
      )}
      {dialog?.kind === "export" && (
        <Dialog title="Export backup" onClose={() => setDialog(null)}>
          <p className="muted" style={{ margin: 0 }}>Copy this text and save it somewhere safe. Use Import backup to restore it later or move your tasks and saved views to another browser.</p>
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
          <p className="muted" style={{ margin: 0 }}>This replaces everything saved in this browser, including saved views. Export a backup first if you want to keep your current tasks.</p>
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-outline" onClick={() => resetTo(emptyData(), "Started an empty workspace")}>Start empty</button>
            <button type="button" className="btn btn-primary" onClick={() => resetTo(sampleData(), "Loaded sample data")}>Load sample data</button>
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
