import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Api, Data, ListConfig, Note, Person, Priority, Project, Status, Task, View } from "./types";
import { COLORS, isoDay, uid } from "./util";

interface NewTask {
  project_id: string;
  title: string;
  parent_task_id?: string | null;
  status?: Status;
  priority?: Priority;
  due_date?: string | null;
  assignMe?: boolean;
}

type TaskPatch = Partial<Pick<Task, "title" | "description" | "status" | "priority" | "context" | "due_date" | "due_time" | "remind_before_minutes" | "project_id" | "position">>;

export interface Store {
  api: Api;
  data: Data;
  me: Person | undefined;
  view: View;
  go(view: View): void;
  selectedId: string | null;
  openTask(id: string | null): void;
  toast(message: string): void;

  /** Unsaved note text, per task. Kept until the note is added or discarded. */
  drafts: Record<string, string>;
  setDraft(taskId: string, text: string): void;
  saveDraft(taskId: string): Note | null;
  discardDraft(taskId: string): void;
  /** Set when you try to leave a task or view with an unsaved note. The app asks what to do. */
  pendingLeave: { to: { kind: "task"; id: string | null } | { kind: "view"; view: View } } | null;
  resolveLeave(choice: "save" | "discard" | "stay"): void;

  /** Multi-select for bulk edits. */
  selection: Set<string>;
  /** Checkboxes are hidden until you choose to select several items at once. */
  selecting: boolean;
  setSelecting(on: boolean): void;
  toggleSelect(id: string): void;
  selectMany(ids: string[], on: boolean): void;
  clearSelection(): void;
  bulkUpdate(ids: string[], patch: Partial<Pick<Task, "status" | "priority" | "context" | "due_date" | "due_time" | "remind_before_minutes" | "project_id">>): void;
  bulkAssign(ids: string[], personId: string, on: boolean): void;
  bulkDelete(ids: string[]): void;

  project(id: string): Project | undefined;
  task(id: string): Task | undefined;
  kids(id: string): Task[];
  topLevel(projectId: string): Task[];
  assigned(taskId: string): Person[];
  tasksFor(personId: string): Task[];
  progress(projectId: string): { total: number; done: number; late: number; pct: number };

  addProject(name: string, color: string, defaultPriority: Priority, categoryId?: string | null): string;
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "color" | "description" | "default_priority" | "default_assignee_ids" | "category_id">>): void;
  addCategory(name: string): string;
  renameCategory(id: string, name: string): void;
  deleteCategory(id: string): void;
  setWorkspaceDefaults(ids: string[]): void;
  /** People who are assigned to new tasks in this project (project override, else workspace default). */
  defaultAssigneesFor(projectId: string): Person[];
  deleteProject(id: string): void;
  addTask(input: NewTask): string;
  updateTask(id: string, patch: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "context" | "due_date" | "due_time" | "remind_before_minutes" | "project_id" | "position">>): void;
  deleteTask(id: string): void;
  toggleAssignee(taskId: string, personId: string): void;
  addPerson(name: string, email: string | null, color?: string): void;
  updatePerson(id: string, patch: Partial<Pick<Person, "full_name" | "email" | "color">>): void;
  deletePerson(id: string): void;

  addSavedFilter(name: string, scope: string, config: ListConfig): void;
  deleteSavedFilter(id: string): void;
}

const Ctx = createContext<Store | null>(null);

/** Every screen starts at the top when you move to it. The main column is the scrolling element. */
function toTop() {
  document.querySelector<HTMLElement>(".main")?.scrollTo({ top: 0 });
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store is not ready");
  return s;
}

function descendants(tasks: Task[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tasks) {
      if (t.parent_task_id && out.has(t.parent_task_id) && !out.has(t.id)) {
        out.add(t.id);
        grew = true;
      }
    }
  }
  return out;
}

export function StoreProvider({ api, children }: { api: Api; children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "home" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selecting, setSelectingState] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<Store["pendingLeave"]>(null);
  const toastTimer = useRef<number>();

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 5000);
  }, []);

  const reload = useCallback(async () => {
    try {
      setData(await api.load());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your tasks.");
    }
  }, [api]);

  useEffect(() => {
    void reload();
    let timer: number | undefined;
    const stop = api.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void reload(), 700);
    });
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [api, reload]);

  const store = useMemo<Store | null>(() => {
    if (!data) return null;

    const mut = (fn: (d: Data) => Data) => setData((d) => (d ? fn(d) : d));
    // Changes show at once; if saving fails we say so and reload what the database has.
    const save = (p: Promise<void>) => {
      p.catch((e: unknown) => {
        toast(`That change was not saved. ${e instanceof Error ? e.message : ""}`.trim());
        void reload();
      });
    };

    const byParent = new Map<string, Task[]>();
    const top = new Map<string, Task[]>();
    for (const t of data.tasks) {
      const key = t.parent_task_id;
      const map = key ? byParent : top;
      const k = key ?? t.project_id;
      const list = map.get(k);
      if (list) list.push(t);
      else map.set(k, [t]);
    }
    const people = new Map(data.people.map((p) => [p.id, p]));
    const tasks = new Map(data.tasks.map((t) => [t.id, t]));
    const me = data.people.find((p) => p.user_id === data.userId);
    const nextPos = () => Date.now();
    const hasDraft = (id: string | null) => !!id && (drafts[id] ?? "").trim().length > 0;
    const dropDraft = (id: string) =>
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    const validPeople = new Set(data.people.map((p) => p.id));
    const defaultIdsFor = (projectId: string): string[] => {
      const project = data.projects.find((p) => p.id === projectId);
      return (project?.default_assignee_ids ?? data.workspace.default_assignee_ids).filter((id) => validPeople.has(id));
    };

    const updateTask = (id: string, rawPatch: TaskPatch) => {
      // A task without a due date cannot have a time or a reminder.
      const patch: TaskPatch = rawPatch.due_date === null ? { ...rawPatch, due_time: null, remind_before_minutes: null } : rawPatch;
      mut((d) => {
        const moving = patch.project_id ? descendants(d.tasks, id) : null;
        return {
          ...d,
          tasks: d.tasks.map((t) => {
            if (t.id === id) {
              const next = { ...t, ...patch };
              if (patch.status) next.completed_at = patch.status === "done" ? (t.completed_at ?? new Date().toISOString()) : null;
              // A subtask moved to another project becomes a task of its own there.
              if (patch.project_id && patch.project_id !== t.project_id) next.parent_task_id = null;
              return next;
            }
            return moving?.has(t.id) ? { ...t, project_id: patch.project_id! } : t;
          }),
        };
      });
      const current = tasks.get(id);
      const remote: Record<string, unknown> = { ...patch };
      if (patch.project_id && current && patch.project_id !== current.project_id && current.parent_task_id) remote.parent_task_id = null;
      save(api.update("tasks", id, remote));
    };

    return {
      api,
      data,
      me,
      view,
      go: (v) => {
        if (hasDraft(selectedId)) setPendingLeave({ to: { kind: "view", view: v } });
        else {
          setView(v);
          setSelectedId(null);
          setSelection(new Set());
          setSelectingState(false);
          toTop();
        }
      },
      selectedId,
      openTask: (id) => {
        if (id === selectedId) return;
        if (hasDraft(selectedId)) setPendingLeave({ to: { kind: "task", id } });
        else setSelectedId(id);
      },
      toast,

      drafts,
      setDraft: (taskId, text) =>
        setDrafts((d) => {
          const next = { ...d };
          if (text.trim()) next[taskId] = text;
          else delete next[taskId];
          return next;
        }),
      saveDraft: (taskId) => {
        const body = (drafts[taskId] ?? "").trim();
        if (!body) return null;
        const note: Note = { id: uid(), task_id: taskId, author_id: data.userId, body, created_at: new Date().toISOString() };
        dropDraft(taskId);
        save(api.insert("task_comments", { id: note.id, task_id: taskId, body }));
        return note;
      },
      discardDraft: (taskId) => dropDraft(taskId),
      pendingLeave,
      resolveLeave: (choice) => {
        const leave = pendingLeave;
        setPendingLeave(null);
        if (!leave || choice === "stay") return;
        if (selectedId && choice === "save" && (drafts[selectedId] ?? "").trim()) {
          const body = drafts[selectedId].trim();
          save(api.insert("task_comments", { id: uid(), task_id: selectedId, body }));
          dropDraft(selectedId);
        }
        if (selectedId && choice === "discard") dropDraft(selectedId);
        if (leave.to.kind === "task") setSelectedId(leave.to.id);
        else {
          setView(leave.to.view);
          setSelectedId(null);
          setSelection(new Set());
          setSelectingState(false);
          toTop();
        }
      },

      selection,
      selecting,
      setSelecting: (on) => {
        setSelectingState(on);
        if (!on) setSelection(new Set());
      },
      toggleSelect: (id) =>
        setSelection((cur) => {
          const next = new Set(cur);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      selectMany: (ids, on) =>
        setSelection((cur) => {
          const next = new Set(cur);
          ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
          return next;
        }),
      clearSelection: () => setSelection(new Set()),
      bulkUpdate: (ids, patch) => {
        ids.forEach((id) => updateTask(id, patch));
      },
      bulkAssign: (ids, personId, on) => {
        mut((d) => ({
          ...d,
          assignees: on
            ? [...d.assignees, ...ids.filter((id) => !d.assignees.some((a) => a.task_id === id && a.person_id === personId)).map((id) => ({ task_id: id, person_id: personId }))]
            : d.assignees.filter((a) => !(ids.includes(a.task_id) && a.person_id === personId)),
        }));
        ids.forEach((id) => save(api.assign(id, personId, on)));
      },
      bulkDelete: (ids) => {
        mut((d) => {
          const gone = new Set<string>();
          ids.forEach((id) => descendants(d.tasks, id).forEach((x) => gone.add(x)));
          return { ...d, tasks: d.tasks.filter((t) => !gone.has(t.id)), assignees: d.assignees.filter((a) => !gone.has(a.task_id)) };
        });
        setSelection(new Set());
        ids.forEach((id) => save(api.remove("tasks", id)));
      },

      project: (id) => data.projects.find((p) => p.id === id),
      task: (id) => tasks.get(id),
      kids: (id) => byParent.get(id) ?? [],
      topLevel: (projectId) => top.get(projectId) ?? [],
      assigned: (taskId) =>
        data.assignees.filter((a) => a.task_id === taskId).map((a) => people.get(a.person_id)).filter((p): p is Person => !!p),
      tasksFor: (personId) => {
        const ids = new Set(data.assignees.filter((a) => a.person_id === personId).map((a) => a.task_id));
        return data.tasks.filter((t) => ids.has(t.id));
      },
      defaultAssigneesFor: (projectId) => defaultIdsFor(projectId).map((id) => people.get(id)).filter((p): p is Person => !!p),
      progress: (projectId) => {
        const list = data.tasks.filter((t) => t.project_id === projectId);
        const today = isoDay();
        const done = list.filter((t) => t.status === "done").length;
        const late = list.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length;
        return { total: list.length, done, late, pct: list.length ? Math.round((100 * done) / list.length) : 0 };
      },

      addProject: (name, color, defaultPriority, categoryId = null) => {
        const row = { id: uid(), workspace_id: data.workspace.id, name, color, position: nextPos(), default_priority: defaultPriority, category_id: categoryId };
        mut((d) => ({ ...d, projects: [...d.projects, { ...row, description: null, default_assignee_ids: null, created_at: new Date().toISOString() }] }));
        save(api.insert("projects", row));
        return row.id;
      },
      updateProject: (id, patch) => {
        mut((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
        save(api.update("projects", id, patch));
      },
      addCategory: (name) => {
        const row = { id: uid(), workspace_id: data.workspace.id, name: name.trim() };
        mut((d) => ({ ...d, categories: [...d.categories, { ...row, created_at: new Date().toISOString() }] }));
        save(api.insert("categories", row));
        return row.id;
      },
      renameCategory: (id, name) => {
        mut((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) }));
        save(api.update("categories", id, { name: name.trim() }));
      },
      deleteCategory: (id) => {
        // Projects in the category stay, and move out of it.
        mut((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id), projects: d.projects.map((p) => (p.category_id === id ? { ...p, category_id: null } : p)) }));
        save(api.remove("categories", id));
      },
      setWorkspaceDefaults: (ids) => {
        mut((d) => ({ ...d, workspace: { ...d.workspace, default_assignee_ids: ids } }));
        save(api.update("workspaces", data.workspace.id, { default_assignee_ids: ids }));
      },
      deleteProject: (id) => {
        mut((d) => ({ ...d, projects: d.projects.filter((p) => p.id !== id), tasks: d.tasks.filter((t) => t.project_id !== id) }));
        save(api.remove("projects", id));
      },

      addTask: (input) => {
        const row = {
          id: uid(),
          project_id: input.project_id,
          parent_task_id: input.parent_task_id ?? null,
          title: input.title,
          status: input.status ?? ("todo" as Status),
          // New tasks take the project's default priority unless one is given.
          priority: input.priority ?? data.projects.find((p) => p.id === input.project_id)?.default_priority ?? ("medium" as Priority),
          due_date: input.due_date ?? null,
          due_time: null,
          remind_before_minutes: null,
          position: nextPos(),
        };
        const now = new Date().toISOString();
        const local: Task = { ...row, context: null, workspace_id: data.workspace.id, description: null, completed_at: row.status === "done" ? now : null, created_at: now };
        // New tasks start with the project's default assignees (or the workspace's), plus you if asked.
        const assignIds = [...new Set([...defaultIdsFor(input.project_id), ...(input.assignMe && me ? [me.id] : [])])];
        mut((d) => ({
          ...d,
          tasks: [...d.tasks, local],
          assignees: [...d.assignees, ...assignIds.map((person_id) => ({ task_id: row.id, person_id }))],
        }));
        save(
          api.insert("tasks", row).then(() => Promise.all(assignIds.map((pid) => api.assign(row.id, pid, true))).then(() => undefined)),
        );
        return row.id;
      },
      updateTask,
      deleteTask: (id) => {
        mut((d) => {
          const gone = descendants(d.tasks, id);
          return { ...d, tasks: d.tasks.filter((t) => !gone.has(t.id)), assignees: d.assignees.filter((a) => !gone.has(a.task_id)) };
        });
        if (selectedId === id) setSelectedId(null);
        save(api.remove("tasks", id));
      },
      toggleAssignee: (taskId, personId) => {
        const on = !data.assignees.some((a) => a.task_id === taskId && a.person_id === personId);
        mut((d) => ({
          ...d,
          assignees: on
            ? [...d.assignees, { task_id: taskId, person_id: personId }]
            : d.assignees.filter((a) => !(a.task_id === taskId && a.person_id === personId)),
        }));
        save(api.assign(taskId, personId, on));
      },

      addPerson: (name, email, color) => {
        const row = { id: uid(), workspace_id: data.workspace.id, full_name: name, email, color: color ?? COLORS[data.people.length % COLORS.length] };
        mut((d) => ({ ...d, people: [...d.people, { ...row, user_id: null }] }));
        save(api.insert("people", row));
      },
      updatePerson: (id, patch) => {
        mut((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
        save(api.update("people", id, patch));
      },
      deletePerson: (id) => {
        mut((d) => ({ ...d, people: d.people.filter((p) => p.id !== id), assignees: d.assignees.filter((a) => a.person_id !== id) }));
        save(api.remove("people", id));
      },

      addSavedFilter: (name, scope, config) => {
        const row = { id: uid(), workspace_id: data.workspace.id, name: name.trim(), scope, config };
        mut((d) => ({ ...d, savedFilters: [...d.savedFilters, { ...row, owner_id: d.userId, created_at: new Date().toISOString() }] }));
        save(api.insert("saved_filters", row));
      },
      deleteSavedFilter: (id) => {
        mut((d) => ({ ...d, savedFilters: d.savedFilters.filter((f) => f.id !== id) }));
        save(api.remove("saved_filters", id));
      },
    };
  }, [api, data, view, selectedId, toast, reload, drafts, selection, selecting, pendingLeave]);

  if (error && !store) {
    return (
      <div className="center-screen">
        <div className="notice">
          <h2>Your tasks did not load</h2>
          <p>{error}</p>
          <button className="btn primary" onClick={() => void reload()}>Try again</button>
        </div>
      </div>
    );
  }
  if (!store) return <div className="center-screen"><div className="spinner" aria-label="Loading your tasks" /></div>;

  return (
    <Ctx.Provider value={store}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}
