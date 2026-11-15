export type Status = "todo" | "in_progress" | "blocked" | "review" | "done";
export type Priority = "none" | "low" | "medium" | "high" | "urgent";

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
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
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
  author_id: string;
  body: string;
  created_at: string;
}

export interface Data {
  userId: string;
  email: string;
  workspace: { id: string; name: string; default_assignee_ids: string[] };
  projects: Project[];
  tasks: Task[];
  people: Person[];
  assignees: Assignee[];
}

export type Table = "workspaces" | "projects" | "tasks" | "people" | "task_comments";

/** Everything the app needs from a backend. Supabase and the demo both implement it. */
export interface Api {
  demo: boolean;
  load(): Promise<Data>;
  insert(table: Table, row: Record<string, unknown>): Promise<void>;
  update(table: Table, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(table: Table, id: string): Promise<void>;
  assign(taskId: string, personId: string, on: boolean): Promise<void>;
  notes(taskId: string): Promise<Note[]>;
  subscribe(onChange: () => void): () => void;
}

export type View =
  | { kind: "home" }
  | { kind: "projects" }
  | { kind: "project"; id: string }
  | { kind: "my" }
  | { kind: "people" };
