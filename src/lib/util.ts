import type { CSSProperties } from "react";
import type { Priority, Status, Task, TaskContext } from "./types";

export const COLORS = ["#3157E0", "#0B8478", "#2F8540", "#B26A00", "#D4472F", "#B8357F", "#6F47D0", "#55657F"];

export const STATUSES: { id: Status; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

/** Flag colours: urgent pink, high red, medium yellow, low green. */
export const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: "none", label: "No priority", color: "#94A3B8" },
  { id: "low", label: "Low", color: "#16A34A" },
  { id: "medium", label: "Medium", color: "#E0A800" },
  { id: "high", label: "High", color: "#DC2626" },
  { id: "urgent", label: "Urgent", color: "#DB2777" },
];

/** Where or how a task can be done. Filter by these when you are away from your computer. */
export const CONTEXTS: { id: TaskContext; label: string }[] = [
  { id: "computer", label: "Computer" },
  { id: "phone", label: "Phone" },
  { id: "home", label: "Home" },
  { id: "errands", label: "Errands" },
  { id: "car", label: "Car" },
];

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

/** The app shows three steps; "blocked" and "review" rows from elsewhere count as in progress. */
export function step(status: Status): "todo" | "in_progress" | "done" {
  return status === "done" ? "done" : status === "todo" ? "todo" : "in_progress";
}

export function uid(): string {
  return crypto.randomUUID();
}

export function isoDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dueLabel(day: string): string {
  const today = isoDay();
  if (day === today) return "Today";
  if (day === addDays(1)) return "Tomorrow";
  if (day === addDays(-1)) return "Yesterday";
  const d = parseDay(day);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export type DueTone = "late" | "today" | "soon" | "later";

export function dueTone(day: string): DueTone {
  const today = isoDay();
  if (day < today) return "late";
  if (day === today) return "today";
  return day <= addDays(7) ? "soon" : "later";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Open tasks first by due date, then priority, then manual order. */
export function byUrgency(a: Task, b: Task): number {
  const ad = a.due_date ?? "9999", bd = b.due_date ?? "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  return a.position - b.position;
}

export function tint(color: string): CSSProperties {
  return { ["--pc" as string]: color } as CSSProperties;
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** The moment a task is due. With no time set, that is 9:00 AM. */
export function dueMoment(day: string, time: string | null): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = (time ?? "09:00").split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** When a reminder should fire, or null if the task has no reminder. */
export function reminderMoment(task: { due_date: string | null; due_time: string | null; remind_before_minutes: number | null }): Date | null {
  if (!task.due_date || task.remind_before_minutes === null) return null;
  return new Date(dueMoment(task.due_date, task.due_time).getTime() - task.remind_before_minutes * 60000);
}

/** Sort order for a project's tasks. "assignedName" returns the first assignee's name for a task. */
export function sortCompare(key: "due" | "priority" | "assigned" | "manual", assignedName: (taskId: string) => string): (a: Task, b: Task) => number {
  switch (key) {
    case "priority":
      // Priority first, then the order you dragged tasks into.
      return (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.position - b.position;
    case "assigned":
      return (a, b) => {
        const an = assignedName(a.id), bn = assignedName(b.id);
        if (an !== bn) return an === "" ? 1 : bn === "" ? -1 : an.localeCompare(bn);
        return byUrgency(a, b);
      };
    case "manual":
      // Exactly the order you dragged tasks into.
      return (a, b) => a.position - b.position;
    default:
      return byUrgency;
  }
}
