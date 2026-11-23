import type { Store } from "./store";
import type { Task } from "./types";
import { kidsScope, placeBetween, type DragSpec, type ReorderScope } from "./drag";

/**
 * What dragging a task can do:
 *  - drop it above or below a row in its own list to reorder it (saved, so the order sticks);
 *  - a subtask dropped onto another task becomes that task's subtask, at the end of its list;
 *  - a subtask dropped above or below another task's subtask joins that list at that spot.
 * A task can never be dropped onto itself or anything under it.
 * `own` is the list the dragged row is in; without it the row can only be moved to another task.
 */
export function dragSpecFor(s: Store, task: Task, own: ReorderScope | undefined): DragSpec {
  const isSub = !!task.parent_task_id;
  return {
    id: task.id,
    label: task.title,
    resolve(targetId, scope, zone) {
      const target = s.task(targetId);
      if (!target || s.isWithin(targetId, task.id)) return null;
      const edge = zone < 0.5 ? "before" : "after";
      if (own && scope === own.key) return edge;
      if (!isSub) return null;
      // Another task's subtask: join that list beside it.
      if (target.parent_task_id && scope === kidsScope(target.parent_task_id)) return edge;
      // Any other task: become its subtask. Its current parent would change nothing.
      return targetId === task.parent_task_id ? null : "into";
    },
    drop(targetId, kind, scope) {
      const target = s.task(targetId);
      if (!target) return;
      if (kind === "into") {
        const kids = s.kids(targetId).filter((k) => k.id !== task.id);
        const end = kids.length ? kids[kids.length - 1].position + 1000 : Date.now();
        s.moveTask(task.id, targetId, end);
        s.toast(`"${task.title}" is now a subtask of "${target.title}".`);
        return;
      }
      if (own && scope === own.key) {
        s.updateTask(task.id, { position: placeBetween(own.list, task.id, target, kind) });
        return;
      }
      const parentId = target.parent_task_id;
      if (!parentId) return;
      const parent = s.task(parentId);
      s.moveTask(task.id, parentId, placeBetween(s.kids(parentId), task.id, target, kind));
      if (parent) s.toast(`"${task.title}" moved to "${parent.title}".`);
    },
  };
}
