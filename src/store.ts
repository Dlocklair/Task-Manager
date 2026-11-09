import { useEffect, useReducer } from "react";
import type { AppData, Note, PriorityKey, Project, StatusKey, Subtask, Task } from "./types";
import { STORAGE_KEY } from "./constants";
import { sampleData } from "./sample";
import { uid } from "./utils";

export type Action =
  | { type: "replaceAll"; data: AppData }
  | { type: "addProject"; project: Project }
  | { type: "updateProject"; id: string; patch: Partial<Omit<Project, "id">> }
  | { type: "deleteProject"; id: string }
  | { type: "addTask"; task: Task }
  | { type: "updateTask"; id: string; patch: Partial<Omit<Task, "id" | "subtasks" | "notes">> }
  | { type: "setStatus"; id: string; status: StatusKey }
  | { type: "deleteTask"; id: string }
  | { type: "addSubtask"; taskId: string; title: string }
  | { type: "updateSubtask"; taskId: string; subtaskId: string; patch: Partial<Omit<Subtask, "id">> }
  | { type: "deleteSubtask"; taskId: string; subtaskId: string }
  | { type: "moveSubtask"; taskId: string; subtaskId: string; dir: -1 | 1 }
  | { type: "addNote"; taskId: string; text: string }
  | { type: "updateNote"; taskId: string; noteId: string; text: string }
  | { type: "deleteNote"; taskId: string; noteId: string };

function mapTask(data: AppData, id: string, fn: (t: Task) => Task): AppData {
  return { ...data, tasks: data.tasks.map((t) => (t.id === id ? fn(t) : t)) };
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
      };
    case "addTask":
      return { ...data, tasks: [a.task, ...data.tasks] };
    case "updateTask":
      return mapTask(data, a.id, (t) => ({ ...t, ...a.patch }));
    case "setStatus":
      return mapTask(data, a.id, (t) => ({
        ...t,
        status: a.status,
        completedAt: a.status === "done" ? (t.completedAt ?? Date.now()) : null,
      }));
    case "deleteTask":
      return { ...data, tasks: data.tasks.filter((t) => t.id !== a.id) };
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
  }
}

function isValid(d: unknown): d is AppData {
  if (!d || typeof d !== "object") return false;
  const x = d as AppData;
  return x.version === 1 && Array.isArray(x.projects) && Array.isArray(x.tasks);
}

export function parseData(raw: string): AppData | null {
  try {
    const d = JSON.parse(raw);
    return isValid(d) ? d : null;
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

export function newTask(init: {
  projectId: string;
  title: string;
  status?: StatusKey;
  priority?: PriorityKey;
  due?: string;
  owner?: string;
  description?: string;
}): Task {
  return {
    id: uid(),
    projectId: init.projectId,
    title: init.title,
    description: init.description ?? "",
    status: init.status ?? "todo",
    priority: init.priority ?? "medium",
    due: init.due ?? "",
    owner: init.owner ?? "",
    subtasks: [],
    notes: [],
    createdAt: Date.now(),
    completedAt: null,
  };
}
