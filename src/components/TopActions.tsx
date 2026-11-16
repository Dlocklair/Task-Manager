import { createContext, useContext } from "react";
import { ListChecks, Plus } from "lucide-react";
import { useStore } from "../lib/store";

/** Opens the New task dialog. Provided once by the workspace screen. */
export const NewTaskContext = createContext<() => void>(() => {});

/** Select multiple and New task. Each screen places it at the right of its first header row. */
export function TopActions() {
  const s = useStore();
  const openNewTask = useContext(NewTaskContext);
  return (
    <div className="top-actions">
      <button className={"btn" + (s.selecting ? " primary" : "")} aria-pressed={s.selecting} onClick={() => s.setSelecting(!s.selecting)}>
        <ListChecks size={17} />{s.selecting ? "Done selecting" : "Select multiple"}
      </button>
      <button className="new-task" onClick={openNewTask}><Plus size={18} />New task</button>
    </div>
  );
}
