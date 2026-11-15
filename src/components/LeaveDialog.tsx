import { useEffect } from "react";
import { useStore } from "../lib/store";
import { Modal } from "./ui";

/** Asks what to do with an unsaved note before you leave its task, so a note is never lost by accident. */
export function LeaveDialog() {
  const s = useStore();
  const pending = s.pendingLeave;
  const hasDraft = Object.values(s.drafts).some((t) => t.trim());

  // Also warn before the browser tab or app closes with an unsaved note.
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDraft]);

  if (!pending || !s.selectedId) return null;
  const title = s.task(s.selectedId)?.title ?? "this task";
  return (
    <Modal title="Note not added yet" onClose={() => s.resolveLeave("stay")}>
      <div className="form leave-body">
        <p>You wrote a note on <strong>{title}</strong> but did not add it. Would you like to add it before you leave?</p>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => s.resolveLeave("discard")}>Discard note</button>
          <span className="grow" />
          <button type="button" className="btn" onClick={() => s.resolveLeave("stay")}>Keep editing</button>
          <button type="button" className="btn primary" onClick={() => s.resolveLeave("save")}>Add note</button>
        </div>
      </div>
    </Modal>
  );
}
