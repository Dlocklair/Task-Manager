import { useEffect, useReducer } from "react";
import type { AppData, Filters, Note, PriorityKey, Project, SavedView, StatusKey, Subtask, Task } from "./types";
import { STORAGE_KEY } from "./constants";
import { sampleData } from "./sample";
import { uid } from "./utils";

export type Action =
  | { type: "replaceAll"; data: AppData }
  | { type: "addProject"; project: Project }
  | { type: "updateProject"; id: string; patch: Partial<Omit<Project, "id">> }
  | { type: "deleteProject"; id: string }
  | { type: "addTask"; task: Task }
  | { type: "updateTask"; id: string; patch: Partial<Omit<Task, "id" | "subtasks" | "notes" | "order">> }
  | { type: "setStatus"; id: string; status: StatusKey }
  | { type: "deleteTask"; id: string }
  /** Move `id` to just before/after `targetId` among tasks of the same priority. */
  | { type: "reorder"; id: string; targetId: string; place: "before" | "after" }
  | { type: "addSubtask"; taskId: string; title: string }
  | { type: "updateSubtask"; taskId: string; subtaskId: string; patch: Partial<Omit<Subtask, "id">> }
  | { type: "deleteSubtask"; taskId: string; subtaskId: string }
  | { type: "moveSubtask"; taskId: string; subtaskId: string; dir: -1 | 1 }
  | { type: "addNote"; taskId: string; text: string }
  | { type: "updateNote"; taskId: string; noteId: string; text: string }
  | { type: "deleteNote"; taskId: string; noteId: string }
  | { type: "addSavedView"; view: SavedView }
  | { type: "updateSavedView"; id: string; patch: { name?: string; filters?: Filters } }
  | { type: "deleteSavedView"; id: string };

function mapTask(data: AppData, id: string, fn: (t: Task) => Task): AppData {
  return { ...data, tasks: data.tasks.map((t) => (t.id === id ? fn(t) : t)) };
}

/** Lowest order among tasks of a priority, minus one: new tasks land at the top of their priority. */
export function topOrder(tasks: Task[], priority: PriorityKey): number {
  const orders = tasks.filter((t) => t.priority === priority).map((t) => t.order);
  return orders.length ? Math.min(...orders) - 1 : 0;
}

export function reducer(data: AppData, a: Action): AppData {
  switch (a.type) {
    case "replaceAll":
      return a.data;
    case "addProject":
      return { ...data, projects: [...data.projects, a.project] };
    case "updateProject":
      return { ...data, projects: data.projects.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) };
    case "deleteProject":
      return {
        ...data,
        projects: data.projects.filter((p) => p.id !== a.id),
        tasks: data.tasks.filter((t) => t.projectId !== a.id),
        savedViews: data.savedViews.map((v) => (v.filters.projectId === a.id ? { ...v, filters: { ...v.filters, projectId: null } } : v)),
      };
    case "addTask":
      return { ...data, tasks: [a.task, ...data.tasks] };
    case "updateTask":
      return mapTask(data, a.id, (t) => {
        const next = { ...t, ...a.patch };
        // Changing priority puts the task at the top of its new priority group.
        if (a.patch.priority && a.patch.priority !== t.priority) next.order = topOrder(data.tasks, a.patch.priority);
        return next;
      });
    case "setStatus":
      return mapTask(data, a.id, (t) => ({
        ...t,
        status: a.status,
        completedAt: a.status === "done" ? (t.completedAt ?? Date.now()) : null,
      }));
    case "deleteTask":
      return { ...data, tasks: data.tasks.filter((t) => t.id !== a.id) };
    case "reorder": {
      const moving = data.tasks.find((t) => t.id === a.id);
      const target = data.tasks.find((t) => t.id === a.targetId);
      if (!moving || !target || moving.priority !== target.priority || moving.id === target.id) return data;
      const group = data.tasks
        .filter((t) => t.priority === moving.priority && t.id !== moving.id)
        .sort((x, y) => x.order - y.order || y.createdAt - x.createdAt);
      const idx = group.findIndex((t) => t.id === target.id);
      group.splice(a.place === "before" ? idx : idx + 1, 0, moving);
      const newOrder = new Map(group.map((t, i) => [t.id, i]));
      return { ...data, tasks: data.tasks.map((t) => (newOrder.has(t.id) ? { ...t, order: newOrder.get(t.id)! } : t)) };
    }
    case "addSubtask": {
      const sub: Subtask = { id: uid(), title: a.title, done: false };
      return mapTask(data, a.taskId, (t) => ({ ...t, subtasks: [...t.subtasks, sub] }));
    }
    case "updateSubtask":
      return mapTask(data, a.taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.map((s) => (s.id === a.subtaskId ? { ...s, ...a.patch } : s)),
      }));
    case "deleteSubtask":
      return mapTask(data, a.taskId, (t) => ({ ...t, subtasks: t.subtasks.filter((s) => s.id !== a.subtaskId) }));
    case "moveSubtask":
      return mapTask(data, a.taskId, (t) => {
        const i = t.subtasks.findIndex((s) => s.id === a.subtaskId);
        const j = i + a.dir;
        if (i < 0 || j < 0 || j >= t.subtasks.length) return t;
        const next = [...t.subtasks];
        [next[i], next[j]] = [next[j], next[i]];
        return { ...t, subtasks: next };
      });
    case "addNote": {
      const note: Note = { id: uid(), text: a.text, createdAt: Date.now() };
      return mapTask(data, a.taskId, (t) => ({ ...t, notes: [...t.notes, note] }));
    }
    case "updateNote":
      return mapTask(data, a.taskId, (t) => ({
        ...t,
        notes: t.notes.map((n) => (n.id === a.noteId ? { ...n, text: a.text } : n)),
      }));
    case "deleteNote":
      return mapTask(data, a.taskId, (t) => ({ ...t, notes: t.notes.filter((n) => n.id !== a.noteId) }));
    case "addSavedView":
      return { ...data, savedViews: [...data.savedViews, a.view] };
    case "updateSavedView":
      return {
        ...data,
        savedViews: data.savedViews.map((v) =>
          v.id === a.id ? { ...v, ...(a.patch.name !== undefined ? { name: a.patch.name } : {}), ...(a.patch.filters ? { filters: a.patch.filters } : {}) } : v,
        ),
      };
    case "deleteSavedView":
      return { ...data, savedViews: data.savedViews.filter((v) => v.id !== a.id) };
  }
}

/** Accepts current (v2) data and upgrades v1 backups: "In review" becomes "In progress", tasks get a manual order. */
export function migrate(raw: unknown): AppData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as { version?: number; projects?: unknown; tasks?: unknown; savedViews?: unknown };
  if (!Array.isArray(d.projects) || !Array.isArray(d.tasks)) return null;
  if (d.version !== 1 && d.version !== 2) return null;
  const tasks = (d.tasks as (Omit<Task, "status"> & { status: string })[]).map((t, i) => ({
    ...t,
    status: (t.status === "review" ? "progress" : t.status) as StatusKey,
    order: typeof t.order === "number" ? t.order : i,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    notes: Array.isArray(t.notes) ? t.notes : [],
  }));
  return {
    version: 2,
    projects: d.projects as Project[],
    tasks,
    savedViews: Array.isArray(d.savedViews) ? (d.savedViews as SavedView[]) : [],
  };
}

export function parseData(raw: string): AppData | null {
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

function load(): AppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = parseData(raw);
      if (d) return d;
    }
  } catch {
    /* storage unavailable — fall through to sample data */
  }
  return sampleData();
}

export function useAppData() {
  const [data, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable: data lives in memory for this visit */
    }
  }, [data]);
  return [data, dispatch] as const;
}

export function newTask(
  init: {
    projectId: string;
    title: string;
    status?: StatusKey;
    priority?: PriorityKey;
    due?: string;
    owner?: string;
    description?: string;
  },
  existing: Task[],
): Task {
  const priority = init.priority ?? "medium";
  return {
    id: uid(),
    projectId: init.projectId,
    title: init.title,
    description: init.description ?? "",
    status: init.status ?? "todo",
    priority,
    due: init.due ?? "",
    owner: init.owner ?? "",
    subtasks: [],
    notes: [],
    order: topOrder(existing, priority),
    createdAt: Date.now(),
    completedAt: null,
  };
}
