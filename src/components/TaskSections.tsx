import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Section } from "../lib/listing";
import type { GroupKey } from "../lib/types";
import { TaskRow } from "./TaskList";

/** Heading colour classes. The status groups and the Overdue and Today due buckets use these. */
const TONE: Record<string, string> = { in_progress: "in_progress", todo: "", done: "done", "1": "late", "2": "today" };

/** openDone shows the Done section open, used while searching closed tasks so matches are visible. */
/**
 * reorderable turns on drag-and-drop ordering. Each row sees its own section, so a drop lands
 * between neighbours in that section, and a drop onto another priority changes the task's priority.
 */
export function TaskSections({ sections, groupBy, showProject = false, openDone = false, reorderable = false }: { sections: Section[]; groupBy: GroupKey; showProject?: boolean; openDone?: boolean; reorderable?: boolean }) {
  const [toggled, setToggled] = useState(false);
  const showDone = openDone || toggled;

  if (sections.length === 0) return null;

  if (groupBy === "none") {
    return <div className="rows">{sections[0].tasks.map((t) => <TaskRow key={t.id} task={t} showProject={showProject} reorder={reorderable ? sections[0].tasks : undefined} />)}</div>;
  }

  return (
    <>
      {sections.map((sec) => {
        const tone = groupBy === "due" || groupBy === "status" ? TONE[sec.key] ?? "" : "";
        const count = <span>{sec.tasks.length}</span>;
        if (sec.collapsible) {
          return (
            <section key={sec.key} className="group">
              <button className="group-head done as-button" aria-expanded={showDone} onClick={() => setToggled(!toggled)}>
                <i />{sec.title}{count}<ChevronDown size={16} className={showDone ? "flip" : ""} />
              </button>
              {showDone && <div className="rows">{sec.tasks.map((t) => <TaskRow key={t.id} task={t} showProject={showProject} reorder={reorderable ? sec.tasks : undefined} />)}</div>}
            </section>
          );
        }
        return (
          <section key={sec.key} className="group">
            <h2 className={`group-head ${tone}`}>
              <i style={sec.color ? { background: sec.color } : undefined} />
              {sec.title}
              {count}
            </h2>
            <div className="rows">{sec.tasks.map((t) => <TaskRow key={t.id} task={t} showProject={showProject} reorder={reorderable ? sec.tasks : undefined} />)}</div>
          </section>
        );
      })}
    </>
  );
}
