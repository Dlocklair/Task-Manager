import type { Filters, Project, SortDir, SortKey, Task } from "./types";
import { DEFAULT_FILTERS, DUE_OPTIONS, STATUS_FILTER_OPTIONS, STATUS_RANK, SORT_OPTIONS, priorityDef } from "./constants";
import { daysFromToday } from "./utils";

export function matchesFilters(t: Task, f: Filters, projects: Project[]): boolean {
  if (f.projectId && t.projectId !== f.projectId) return false;

  if (f.status === "open" && t.status === "done") return false;
  if (f.status !== "any" && f.status !== "open" && t.status !== f.status) return false;

  if (f.priorities.length && !f.priorities.includes(t.priority)) return false;

  if (f.due !== "any") {
    if (f.due === "nodate") {
      if (t.due) return false;
    } else {
      // Date-based ranges only make sense for work that is still open.
      if (!t.due || t.status === "done") return false;
      const d = daysFromToday(t.due);
      if (f.due === "overdue" && !(d < 0)) return false;
      if (f.due === "today" && d !== 0) return false;
      if (f.due === "week" && !(d >= 0 && d <= 7)) return false;
    }
  }

  const q = f.query.trim().toLowerCase();
  if (q) {
    const pName = projects.find((p) => p.id === t.projectId)?.name ?? "";
    const hay = [t.title, t.description, t.owner, pName, ...t.subtasks.map((s) => s.title), ...t.notes.map((n) => n.text)]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

const byPriority = (a: Task, b: Task) => priorityDef(b.priority).level - priorityDef(a.priority).level;
const byOrder = (a: Task, b: Task) => a.order - b.order || b.createdAt - a.createdAt;
const dueVal = (t: Task) => (t.due ? daysFromToday(t.due) : Number.POSITIVE_INFINITY);

/**
 * Every sort ends with priority, then the manual (drag) order, so tasks of the
 * same priority always appear in the order you arranged them.
 */
export function sortTasks(tasks: Task[], key: SortKey, dir: SortDir, projects: Project[]): Task[] {
  const sign = dir === "asc" ? 1 : -1;
  const projName = (t: Task) => projects.find((p) => p.id === t.projectId)?.name.toLowerCase() ?? "";
  const primary = (a: Task, b: Task): number => {
    switch (key) {
      case "priority":
        return byPriority(a, b);
      case "due": {
        // Finished work goes after open work, whatever its date.
        const doneA = a.status === "done" ? 1 : 0, doneB = b.status === "done" ? 1 : 0;
        if (doneA !== doneB) return doneA - doneB;
        const da = dueVal(a), db = dueVal(b);
        if (da === db) return 0;
        if (da === Infinity) return 1; // no date always last
        if (db === Infinity) return -1;
        return da - db;
      }
      case "status":
        return STATUS_RANK[a.status] - STATUS_RANK[b.status];
      case "project":
        return projName(a).localeCompare(projName(b));
    }
  };
  return [...tasks].sort((a, b) => sign * primary(a, b) || byPriority(a, b) || byOrder(a, b));
}

/** Tasks can be dragged onto each other when they share a priority and the same group under the current sort. */
export function canReorder(a: Task, b: Task, key: SortKey): boolean {
  if (a.id === b.id || a.priority !== b.priority) return false;
  if (key === "due") return false;
  if (key === "status") return a.status === b.status;
  if (key === "project") return a.projectId === b.projectId;
  return true;
}

export function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.projectId === b.projectId &&
    a.due === b.due &&
    a.status === b.status &&
    a.query.trim() === b.query.trim() &&
    a.sort === b.sort &&
    a.dir === b.dir &&
    [...a.priorities].sort().join() === [...b.priorities].sort().join()
  );
}

/** Narrowing filters only (ignores project, which the sidebar shows, and sort). */
export function hasActiveFilters(f: Filters): boolean {
  return f.due !== "any" || f.status !== "any" || f.priorities.length > 0 || !!f.query.trim();
}

export function describeFilters(f: Filters, projects: Project[]): string {
  const bits: string[] = [];
  bits.push(f.projectId ? (projects.find((p) => p.id === f.projectId)?.name ?? "Deleted project") : "All projects");
  if (f.priorities.length) bits.push(f.priorities.map((p) => priorityDef(p).label).join(" or ") + " priority");
  if (f.due !== "any") bits.push(DUE_OPTIONS.find((d) => d.key === f.due)!.label);
  if (f.status !== "any") bits.push(STATUS_FILTER_OPTIONS.find((s) => s.key === f.status)!.label);
  if (f.query.trim()) bits.push(`“${f.query.trim()}”`);
  if (f.sort !== DEFAULT_FILTERS.sort || f.dir !== DEFAULT_FILTERS.dir) {
    bits.push(`sorted by ${SORT_OPTIONS.find((s) => s.key === f.sort)!.label.toLowerCase()}${f.dir === "desc" ? " (reversed)" : ""}`);
  }
  return bits.join(" · ");
}
