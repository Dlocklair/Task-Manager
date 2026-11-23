import type { Task } from "./types";

/**
 * Drag and drop for tasks and subtasks, built on pointer events so it works the same with a mouse,
 * a finger on an iPad or phone, or a pencil. (The browser's built-in drag and drop is unreliable on
 * iPad Safari, which is why a drop there sometimes did not stick.)
 *
 * Rows that can take a drop carry data-drop-id (the task id) and data-drop-scope (which list they are in).
 * A drag asks its spec what a hover over a row means, shows a line or outline there, and on release
 * hands the drop to the spec, which saves it.
 */
export type DropKind = "before" | "after" | "into";

export interface DragSpec {
  id: string;
  label: string;
  /** What dropping on this row would do, or null when it can't go there. zone is 0 at the row's top, 1 at its bottom. */
  resolve(targetId: string, scope: string | null, zone: number): DropKind | null;
  drop(targetId: string, kind: DropKind, scope: string | null): void;
}

/** Which list a set of rows belongs to. Subtasks of one task share a scope wherever they are shown. */
export const kidsScope = (parentId: string) => `kids:${parentId}`;

/** Dragging to reorder a main list is on when it is sorted by My order. */
export type ReorderMode = "manual";

/** A set of tasks that can be reordered among themselves. */
export interface ReorderScope {
  key: string;
  list: Task[];
}

/**
 * Drop position for a task placed just above or below `target`. `siblings` is the list in its current order;
 * the dragged task is skipped so it does not count as its own neighbour.
 */
export function placeBetween(siblings: Task[], dragId: string, target: Task, edge: "before" | "after"): number {
  const others = siblings.filter((t) => t.id !== dragId);
  const i = others.findIndex((t) => t.id === target.id);
  if (i < 0) return edge === "before" ? target.position - 1 : target.position + 1;
  if (edge === "before") {
    const prev = others[i - 1];
    return prev ? (prev.position + target.position) / 2 : target.position - 1000;
  }
  const next = others[i + 1];
  return next ? (target.position + next.position) / 2 : target.position + 1000;
}

const THRESHOLD = 5;
const EDGE = 60;

function scrollParent(el: Element | null): HTMLElement | null {
  for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return (document.scrollingElement as HTMLElement) ?? null;
}

/** The element under a point, looking through the dimmed backdrop behind the task panel. */
function pick(x: number, y: number): Element | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.classList.contains("detail-scrim") || el.classList.contains("drag-ghost")) continue;
    return el;
  }
  return null;
}

let active = false;
export const isDragging = () => active;

/** Call from the grip's onPointerDown. */
export function beginDrag(e: { pointerId: number; button: number; clientX: number; clientY: number; preventDefault(): void; stopPropagation(): void }, spec: DragSpec) {
  if (e.button !== 0 || active) return;
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX, startY = e.clientY;
  let started = false;
  let x = startX, y = startY;
  let ghost: HTMLDivElement | null = null;
  let current: { el: HTMLElement; id: string; scope: string | null; kind: DropKind } | null = null;
  let raf = 0;

  const clear = () => {
    if (current) current.el.classList.remove("drop-before", "drop-after", "drop-into");
    current = null;
  };

  const hitTest = () => {
    const under = pick(x, y);
    const el = under?.closest<HTMLElement>("[data-drop-id]") ?? null;
    if (!el) return clear();
    const id = el.dataset.dropId!;
    const scope = el.dataset.dropScope ?? null;
    const box = el.getBoundingClientRect();
    const zone = Math.min(1, Math.max(0, (y - box.top) / Math.max(1, box.height)));
    const kind = id === spec.id ? null : spec.resolve(id, scope, zone);
    if (!kind) return clear();
    if (current && current.el === el && current.kind === kind) return;
    clear();
    el.classList.add(`drop-${kind}`);
    current = { el, id, scope, kind };
  };

  // Scrolls the list or panel under the pointer when you hold a task near its top or bottom edge.
  const tick = () => {
    if (!started) return;
    const box = scrollParent(pick(x, y));
    if (box) {
      const r = box === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : box.getBoundingClientRect();
      const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, window.innerHeight);
      if (y < top + EDGE) box.scrollTop -= Math.ceil((top + EDGE - y) / 4);
      else if (y > bottom - EDGE) box.scrollTop += Math.ceil((y - (bottom - EDGE)) / 4);
    }
    hitTest();
    raf = requestAnimationFrame(tick);
  };

  // Holding the grip must not select the text it passes over.
  const noSelect = (ev: Event) => ev.preventDefault();
  document.addEventListener("selectstart", noSelect);

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    x = ev.clientX;
    y = ev.clientY;
    if (!started) {
      if (Math.hypot(x - startX, y - startY) < THRESHOLD) return;
      started = true;
      active = true;
      window.getSelection()?.removeAllRanges();
      document.documentElement.classList.add("is-dragging");
      ghost = document.createElement("div");
      ghost.className = "drag-ghost";
      ghost.textContent = spec.label;
      document.body.appendChild(ghost);
      raf = requestAnimationFrame(tick);
    }
    ev.preventDefault();
    if (ghost) ghost.style.transform = `translate(${x + 14}px, ${y + 10}px)`;
    hitTest();
  };

  const finish = (commit: boolean) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key);
    document.removeEventListener("selectstart", noSelect);
    cancelAnimationFrame(raf);
    const target = current;
    clear();
    ghost?.remove();
    document.documentElement.classList.remove("is-dragging");
    if (started) {
      // The click that follows a drag must not open the row it ended on.
      const eat = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener("click", eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", eat, { capture: true }), 50);
    }
    active = false;
    if (commit && started && target) spec.drop(target.id, target.kind, target.scope);
  };
  const up = (ev: PointerEvent) => ev.pointerId === e.pointerId && finish(true);
  const cancel = (ev: PointerEvent) => ev.pointerId === e.pointerId && finish(false);
  const key = (ev: KeyboardEvent) => ev.key === "Escape" && finish(false);

  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key);
}
