import type { Api, Assignee, Category, Data, Note, Person, Project, SavedFilter, Task } from "./types";
import { COLORS, DEFAULT_CONTEXTS } from "./util";

// A device-only copy of the data. It lives in this browser on this device and is never sent anywhere.
// It implements the same interface as the cloud version, so the screens work unchanged.
const KEY = "task-manager-on-this-device";
const WS = "device-workspace";
const ME = "device-me";

interface Db {
  workspace: Data["workspace"];
  projects: Project[];
  categories: Category[];
  tasks: Task[];
  people: Person[];
  assignees: Assignee[];
  savedFilters: SavedFilter[];
  notes: Note[];
}

function empty(): Db {
  return {
    workspace: { id: WS, name: "On this device", default_assignee_ids: [], contexts: DEFAULT_CONTEXTS },
    projects: [],
    categories: [],
    tasks: [],
    people: [{ id: "device-you", workspace_id: WS, user_id: ME, full_name: "You", email: null, color: COLORS[0] }],
    assignees: [],
    savedFilters: [],
    notes: [],
  };
}

function read(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = { ...empty(), ...(JSON.parse(raw) as Partial<Db>) };
      // Copies saved before contexts could be edited start with the original list.
      if (!Array.isArray(db.workspace.contexts)) db.workspace = { ...db.workspace, contexts: DEFAULT_CONTEXTS };
      return db;
    }
  } catch {
    // Unreadable data starts fresh rather than breaking the app.
  }
  return empty();
}

const listeners = new Set<() => void>();

function write(db: Db) {
  localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((f) => f());
}

/** A task and everything under it. */
function branch(tasks: Task[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tasks) if (t.parent_task_id && out.has(t.parent_task_id) && !out.has(t.id)) { out.add(t.id); grew = true; }
  }
  return out;
}

function dropTasks(db: Db, ids: Set<string>) {
  db.tasks = db.tasks.filter((t) => !ids.has(t.id));
  db.assignees = db.assignees.filter((a) => !ids.has(a.task_id));
  db.notes = db.notes.filter((n) => !ids.has(n.task_id));
}

export const deviceApi: Api = {
  demo: false,
  local: true,

  async load(): Promise<Data> {
    const db = read();
    return {
      userId: ME,
      email: "",
      workspace: db.workspace,
      projects: db.projects,
      categories: db.categories,
      tasks: db.tasks,
      people: db.people,
      assignees: db.assignees,
      savedFilters: db.savedFilters,
      shareLinks: [],
      calendarFeeds: [],
    };
  },

  async insert(table, row) {
    const db = read();
    const now = new Date().toISOString();
    switch (table) {
      case "projects":
        db.projects.push({ description: null, default_assignee_ids: null, created_at: now, ...row } as Project);
        break;
      case "tasks":
        db.tasks.push({
          workspace_id: WS, description: null, due_time: null, remind_before_minutes: null, parent_task_id: null,
          completed_at: row.status === "done" ? now : null, created_at: now, ...row,
        } as Task);
        break;
      case "categories":
        db.categories.push({ created_at: now, ...row } as Category);
        break;
      case "people":
        db.people.push({ workspace_id: WS, user_id: null, ...row } as Person);
        break;
      case "saved_filters":
        db.savedFilters.push({ workspace_id: WS, owner_id: ME, created_at: now, ...row } as SavedFilter);
        break;
      case "task_comments":
        db.notes.push({ author_id: ME, created_at: now, ...row } as Note);
        break;
      default:
        return;
    }
    write(db);
  },

  async update(table, id, patch) {
    const db = read();
    switch (table) {
      case "workspaces":
        db.workspace = { ...db.workspace, ...patch };
        break;
      case "projects":
        db.projects = db.projects.map((p) => (p.id === id ? { ...p, ...patch } : p));
        break;
      case "categories":
        db.categories = db.categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
        break;
      case "people":
        db.people = db.people.map((p) => (p.id === id ? { ...p, ...patch } : p));
        break;
      case "tasks": {
        const moving = "project_id" in patch ? branch(db.tasks, id) : null;
        const now = new Date().toISOString();
        db.tasks = db.tasks.map((t) => {
          if (t.id === id) {
            const next = { ...t, ...patch } as Task;
            if (patch.status) next.completed_at = patch.status === "done" ? (t.completed_at ?? now) : null;
            if ("project_id" in patch && patch.project_id !== t.project_id && !("parent_task_id" in patch)) next.parent_task_id = null;
            return next;
          }
          return moving?.has(t.id) ? { ...t, project_id: (patch.project_id as string | null) ?? null } : t;
        });
        break;
      }
      case "saved_filters":
        db.savedFilters = db.savedFilters.map((f) => (f.id === id ? { ...f, ...patch } : f));
        break;
      case "task_comments":
        db.notes = db.notes.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n));
        break;
      default:
        return;
    }
    write(db);
  },

  async remove(table, id) {
    const db = read();
    switch (table) {
      case "tasks":
        dropTasks(db, branch(db.tasks, id));
        break;
      case "projects": {
        const doomed = new Set(db.tasks.filter((t) => t.project_id === id).map((t) => t.id));
        dropTasks(db, doomed);
        db.projects = db.projects.filter((p) => p.id !== id);
        break;
      }
      case "categories":
        db.categories = db.categories.filter((c) => c.id !== id);
        db.projects = db.projects.map((p) => (p.category_id === id ? { ...p, category_id: null } : p));
        break;
      case "people":
        db.people = db.people.filter((p) => p.id !== id);
        db.assignees = db.assignees.filter((a) => a.person_id !== id);
        break;
      case "saved_filters":
        db.savedFilters = db.savedFilters.filter((f) => f.id !== id);
        break;
      case "task_comments":
        db.notes = db.notes.filter((n) => n.id !== id);
        break;
      default:
        return;
    }
    write(db);
  },

  async assign(taskId, personId, on) {
    const db = read();
    db.assignees = on
      ? db.assignees.some((a) => a.task_id === taskId && a.person_id === personId) ? db.assignees : [...db.assignees, { task_id: taskId, person_id: personId }]
      : db.assignees.filter((a) => !(a.task_id === taskId && a.person_id === personId));
    write(db);
  },

  async notes(taskId) {
    return read().notes.filter((n) => n.task_id === taskId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  subscribe(onChange) {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  },
};

