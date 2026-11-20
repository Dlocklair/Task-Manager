export type Status = "todo" | "in_progress" | "blocked" | "review" | "done";
export type Priority = "none" | "low" | "medium" | "high" | "urgent";
/** Where or how a task can be done: the id of one of the workspace's contexts. Null means no context. */
export type TaskContext = string;

/** One entry in the workspace's list of contexts. You can rename, add, remove and reorder them in Settings. */
export interface ContextDef {
  id: string;
  label: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
  default_priority: Priority;
  /** null = use the workspace default assignees */
  default_assignee_ids: string[] | null;
  /** null = not in a category */
  category_id: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  /** null = not in any project */
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  context: TaskContext | null;
  due_date: string | null;
  /** Time of day it is due (HH:MM). Null means 9:00 AM. */
  due_time: string | null;
  /** Remind this many minutes before the due moment. Null means no reminder. */
  remind_before_minutes: number | null;
  position: number;
  completed_at: string | null;
  created_at: string;
}

export interface Person {
  id: string;
  workspace_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  color: string;
}

export interface Assignee {
  task_id: string;
  person_id: string;
}

export interface Note {
  id: string;
  task_id: string;
  /** null for a note added through an update link */
  author_id: string | null;
  /** The person's name, for notes added through an update link. */
  author_name?: string | null;
  body: string;
  created_at: string;
  /** Set when the note was changed after it was first added. */
  updated_at?: string;
}

/** How a task list is filtered, sorted and grouped. Saved filters store one of these. */
export type SortKey = "due" | "priority" | "manual";
export type GroupKey = "status" | "assigned" | "priority" | "due" | "project" | "none";

export type ListConfig = {
  /** "all", "none" (nobody assigned yet) or a person id */
  who: string;
  /** "all" or a priority */
  priority: string;
  /** "all", "none" (no context) or a context */
  context: string;
  /** "all", "none" (no project) or a project id. Used on All tasks only. */
  project: string;
  hideDone: boolean;
  sortBy: SortKey;
  groupBy: GroupKey;
};

export interface SavedFilter {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  /** "all" for All tasks, or a project id */
  scope: string;
  config: ListConfig;
  created_at: string;
}

export interface Data {
  userId: string;
  email: string;
  workspace: { id: string; name: string; default_assignee_ids: string[]; contexts: ContextDef[] };
  projects: Project[];
  categories: Category[];
  tasks: Task[];
  people: Person[];
  assignees: Assignee[];
  savedFilters: SavedFilter[];
  /** Update links you have made, one per person at most. */
  shareLinks: ShareLink[];
}

/** A link that lets one person see and update the tasks assigned to them, without an account. */
export interface ShareLink {
  token: string;
  person_id: string;
}

export type Table = "workspaces" | "projects" | "categories" | "tasks" | "people" | "task_comments" | "saved_filters";

/** Everything the app needs from a backend. Supabase and the demo both implement it. */
export interface Api {
  demo: boolean;
  /** True for the device-only copy. Nothing is sent to a server. */
  local?: boolean;
  load(): Promise<Data>;
  insert(table: Table, row: Record<string, unknown>): Promise<void>;
  update(table: Table, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(table: Table, id: string): Promise<void>;
  assign(taskId: string, personId: string, on: boolean): Promise<void>;
  notes(taskId: string): Promise<Note[]>;
  subscribe(onChange: () => void): () => void;
  /** Update links. Only the cloud version has them. */
  createShareLink?(workspaceId: string, personId: string): Promise<ShareLink>;
  removeShareLink?(token: string): Promise<void>;
}

export type View =
  | { kind: "home" }
  | { kind: "projects" }
  | { kind: "project"; id: string }
  | { kind: "all" }
  | { kind: "my" }
  | { kind: "people" }
  | { kind: "settings" };
