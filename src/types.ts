export type StatusKey = "todo" | "progress" | "review" | "done";
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
  createdAt: number;
  completedAt: number | null;
}

export interface AppData {
  version: 1;
  projects: Project[];
  tasks: Task[];
}

export type QuickFilter = "overdue" | "today" | "progress" | "done" | null;

export interface ViewState {
  /** null = all projects */
  projectId: string | null;
  quick: QuickFilter;
  priority: PriorityKey | null;
  query: string;
  view: "board" | "list";
  selectedTaskId: string | null;
}
