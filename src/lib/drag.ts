import type { Task } from "./types";

/**
 * The task being dragged right now. Browsers hide drag data until the drop, so rows use this to tell,
 * while you are still dragging, whether a row is a legal place to drop.
 */
let dragging: string | null = null;
export const dragId = () => dragging;
export const startDrag = (id: string) => {
  dragging = id;
};
export const endDrag = () => {
  dragging = null;
};

/** What a drop does. "manual" only changes the order: priority and status never change on a drop. */
export type ReorderMode = "manual";

/** A set of tasks that can be dragged among themselves, and nowhere else. */
export interface ReorderScope {
  list: Task[];
  mode: ReorderMode;
}

/**
 * Drop position for a dragged task placed just above or below `target`. `siblings` is the visible list
 * in its current order; the dragged task is skipped so it does not count as its own neighbour.
 */
export function placeBetween(siblings: Task[], dragId: string, target: Task, edge: "before" | "after"): number {
  const others = siblings.filter((t) => t.id !== dragId);
  const i = others.findIndex((t) => t.id === target.id);
  if (edge === "before") {
    const prev = others[i - 1];
    return prev ? (prev.position + target.position) / 2 : target.position - 1;
  }
  const next = others[i + 1];
  return next ? (target.position + next.position) / 2 : target.position + 1;
}
