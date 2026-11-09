export type StatusKey = "todo" | "progress" | "done";
export type PriorityKey = "urgent" | "high" | "medium" | "low";

export interface Project {
  id: string;
  name: string;
  /** HSL triplet, e.g. "191 80% 58%" — used as hsl(<color>) and hsl(<color> / .14). */
  color: string;
  createdAt: number;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Note {
  id: string;
  text: string;
  createdAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: StatusKey;
  priority: PriorityKey;
  /** ISO date "YYYY-MM-DD" or empty string when there is no due date. */
  due: string;
  owner: string;
  subtasks: Subtask[];
  notes: Note[];
  /** Manual position among tasks of the same priority (lower = higher up). */
  order: number;
  createdAt: number;
  completedAt: number | null;
}

export type DueFilter = "any" | "overdue" | "today" | "week" | "nodate";
export type StatusFilter = "any" | "open" | StatusKey;
export type SortKey = "priority" | "due" | "status" | "project";
export type SortDir = "asc" | "desc";

/** Everything a saved view remembers. */
export interface Filters {
  /** null = all projects */
  projectId: string | null;
  due: DueFilter;
  status: StatusFilter;
  /** empty = any priority */
  priorities: PriorityKey[];
  query: string;
  sort: SortKey;
  dir: SortDir;
}

export interface SavedView {
  id: string;
  name: string;
  filters: Filters;
  createdAt: number;
}

export interface AppData {
  version: 2;
  projects: Project[];
  tasks: Task[];
  savedViews: SavedView[];
}
