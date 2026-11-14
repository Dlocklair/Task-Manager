import type { CSSProperties } from "react";
import type { Priority, Status, Task } from "./types";

export const COLORS = ["#3157E0", "#0B8478", "#2F8540", "#B26A00", "#D4472F", "#B8357F", "#6F47D0", "#55657F"];

export const STATUSES: { id: Status; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "none", label: "No priority" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
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
