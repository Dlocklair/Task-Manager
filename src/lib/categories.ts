import type { Category, Project } from "./types";

export interface ProjectGroup {
  /** null is the group for projects without a category */
  category: Category | null;
  projects: Project[];
}

/** Projects under their categories, A to Z. Projects without a category come last. */
export function groupProjects(projects: Project[], categories: Category[]): ProjectGroup[] {
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  const known = new Set(sorted.map((c) => c.id));
  const groups: ProjectGroup[] = sorted.map((c) => ({ category: c, projects: projects.filter((p) => p.category_id === c.id) }));
  const loose = projects.filter((p) => !p.category_id || !known.has(p.category_id));
  // With no categories at all, the single group is shown as a flat list.
  if (loose.length > 0 || sorted.length === 0) groups.push({ category: null, projects: loose });
  return groups;
}
