import type { GroupKey, ListConfig, Person, Priority, Project, SortKey, Task } from "./types";
import { addDays, CONTEXTS, isoDay, PRIORITIES, sortCompare, STATUSES, step } from "./util";

export const DEFAULT_CONFIG: ListConfig = {
  who: "all",
  priority: "all",
  context: "all",
  project: "all",
  // Finished tasks are hidden unless you ask for them.
  hideDone: true,
  sortBy: "due",
  groupBy: "status",
};

/** All tasks opens grouped by project. */
export const ALL_BASE: ListConfig = { ...DEFAULT_CONFIG, groupBy: "project" };

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "due", label: "Due date" },
  { id: "priority", label: "Priority" },
  { id: "name", label: "Name" },
];

export const GROUP_OPTIONS: { id: GroupKey; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "assigned", label: "Assigned to" },
  { id: "priority", label: "Priority" },
  { id: "due", label: "Due date" },
  { id: "project", label: "Project" },
  { id: "none", label: "No grouping" },
];

/** Urgent first. */
const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low", "none"];

export interface Section {
  key: string;
  title: string;
  /** Dot colour for the heading (a project colour, for example). */
  color?: string;
  tasks: Task[];
  /** The Done section folds away. */
  collapsible: boolean;
}

export interface ListContext {
  people: Person[];
  projects: Project[];
  /** People assigned to a task. */
  assigned(taskId: string): Person[];
}

/** Text search. Closed tasks are only searched when includeClosed is on. */
export interface TextSearch {
  q: string;
  includeClosed: boolean;
}

export const NO_SEARCH: TextSearch = { q: "", includeClosed: false };

export function matchesText(t: Task, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return t.title.toLowerCase().includes(needle) || (t.description ?? "").toLowerCase().includes(needle);
}

/** Search results for a text query. Used by Home and by the list filters. */
export function searchTasks(tasks: Task[], search: TextSearch): Task[] {
  return tasks.filter((t) => {
    if (t.status === "done" && !search.includeClosed) return false;
    return matchesText(t, search.q);
  });
}

/** Keeps the tasks that match the search and the filters in the config. */
export function applyFilters(tasks: Task[], cfg: ListConfig, ctx: ListContext, search: TextSearch = NO_SEARCH): Task[] {
  const searching = search.q.trim().length > 0;
  return tasks.filter((t) => {
    if (searching) {
      if (t.status === "done" && !search.includeClosed) return false;
      if (!matchesText(t, search.q)) return false;
    } else if (cfg.hideDone && t.status === "done") {
      return false;
    }
    if (cfg.priority !== "all" && t.priority !== cfg.priority) return false;
    if (cfg.context !== "all" && (t.context ?? "none") !== cfg.context) return false;
    if (cfg.project !== "all" && t.project_id !== cfg.project) return false;
    if (cfg.who === "all") return true;
    const people = ctx.assigned(t.id);
    return cfg.who === "none" ? people.length === 0 : people.some((p) => p.id === cfg.who);
  });
}

function dueBucket(t: Task): { key: string; title: string } {
  const today = isoDay();
  if (!t.due_date) return { key: "5", title: "No due date" };
  if (t.due_date < today) return { key: "1", title: "Overdue" };
  if (t.due_date === today) return { key: "2", title: "Today" };
  if (t.due_date <= addDays(7)) return { key: "3", title: "Next 7 days" };
  return { key: "4", title: "Later" };
}

/**
 * Splits tasks into sections for the chosen grouping. A task with several people
 * appears under each of them. Empty sections are left out.
 */
export function groupTasks(tasks: Task[], cfg: ListConfig, ctx: ListContext): Section[] {
  const cmp = sortCompare(cfg.sortBy, (id) => ctx.assigned(id)[0]?.full_name ?? "");
  const sorted = [...tasks].sort(cmp);
  const build = (key: string, title: string, list: Task[], extra: Partial<Section> = {}): Section | null =>
    list.length ? { key, title, tasks: list, collapsible: false, ...extra } : null;
  const out: (Section | null)[] = [];

  switch (cfg.groupBy) {
    case "none":
      return [{ key: "all", title: "", tasks: sorted, collapsible: false }];

    case "status": {
      // Open work first. Done folds away and sorts by when it was finished.
      const order: ("in_progress" | "todo" | "done")[] = ["in_progress", "todo", "done"];
      for (const g of order) {
        const list = sorted.filter((t) => step(t.status) === g);
        if (g === "done") list.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
        out.push(build(g, STATUSES.find((x) => x.id === g)!.label, list, { collapsible: g === "done" }));
      }
      break;
    }

    case "assigned": {
      const people = [...ctx.people].sort((a, b) => a.full_name.localeCompare(b.full_name));
      for (const p of people) {
        out.push(build(p.id, p.full_name, sorted.filter((t) => ctx.assigned(t.id).some((x) => x.id === p.id)), { color: p.color }));
      }
      out.push(build("none", "Nobody yet", sorted.filter((t) => ctx.assigned(t.id).length === 0)));
      break;
    }

    case "priority":
      for (const id of PRIORITY_ORDER) {
        const label = PRIORITIES.find((x) => x.id === id)!.label;
        out.push(build(id, label, sorted.filter((t) => t.priority === id)));
      }
      break;

    case "due": {
      const buckets = new Map<string, { title: string; list: Task[] }>();
      for (const t of sorted) {
        const b = dueBucket(t);
        const cur = buckets.get(b.key) ?? { title: b.title, list: [] };
        cur.list.push(t);
        buckets.set(b.key, cur);
      }
      for (const key of [...buckets.keys()].sort()) {
        const b = buckets.get(key)!;
        out.push(build(key, b.title, b.list));
      }
      break;
    }

    case "project":
      for (const p of ctx.projects) {
        out.push(build(p.id, p.name, sorted.filter((t) => t.project_id === p.id), { color: p.color }));
      }
      break;
  }
  return out.filter((s): s is Section => s !== null);
}

const KEYS = Object.keys(DEFAULT_CONFIG) as (keyof ListConfig)[];

/** Compares field by field. Saved JSON does not keep key order, so a string compare would miss matches. */
export function sameConfig(a: ListConfig, b: ListConfig): boolean {
  return KEYS.every((k) => a[k] === b[k]);
}

/** True when a real filter differs from the view's starting settings. Hide done alone does not count. */
export function isChanged(cfg: ListConfig, base: ListConfig = DEFAULT_CONFIG): boolean {
  return !sameConfig({ ...cfg, hideDone: base.hideDone }, base);
}

/** A saved filter may come from an older version of the app, so fill in any missing settings. */
export function normalise(cfg: Partial<ListConfig>, base: ListConfig = DEFAULT_CONFIG): ListConfig {
  return { ...base, ...cfg };
}

/** Plain-language labels for every setting that differs from the view's starting settings. */
export function activeFilters(cfg: ListConfig, base: ListConfig, ctx: ListContext, search: TextSearch): string[] {
  const out: string[] = [];
  if (cfg.who !== base.who) {
    const name = cfg.who === "all" ? "Everyone" : cfg.who === "none" ? "Nobody yet" : (ctx.people.find((p) => p.id === cfg.who)?.full_name ?? "Someone");
    out.push(`Assigned to: ${name}`);
  }
  if (cfg.priority !== base.priority) out.push(`Priority: ${PRIORITIES.find((p) => p.id === cfg.priority)?.label ?? cfg.priority}`);
  if (cfg.context !== base.context) out.push(`Context: ${cfg.context === "none" ? "No context" : (CONTEXTS.find((c) => c.id === cfg.context)?.label ?? cfg.context)}`);
  if (cfg.project !== base.project) out.push(`Project: ${ctx.projects.find((p) => p.id === cfg.project)?.name ?? "Unknown"}`);
  if (cfg.groupBy !== base.groupBy) out.push(`Grouped by: ${GROUP_OPTIONS.find((g) => g.id === cfg.groupBy)?.label ?? cfg.groupBy}`);
  if (cfg.sortBy !== base.sortBy) out.push(`Sorted by: ${SORT_OPTIONS.find((o) => o.id === cfg.sortBy)?.label ?? cfg.sortBy}`);
  if (search.q.trim()) out.push(`Search: "${search.q.trim()}"${search.includeClosed ? " (including closed)" : ""}`);
  return out;
}
