import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Section } from "../lib/listing";
import type { GroupKey } from "../lib/types";
import type { ReorderMode, ReorderScope } from "../lib/drag";
import { TaskRow } from "./TaskList";

/** Heading colour classes. The status groups and the Overdue and Today due buckets use these. */
const TONE: Record<string, string> = { in_progress: "in_progress", todo: "", done: "done", "1": "late", "2": "today" };

/** openDone shows the Done section open, used while searching closed tasks so matches are visible. */
/**
 * reorderable turns on drag-and-drop ordering. Each row only knows its own section, so a task can be
 * dragged within its group and nowhere else. The Done section is ordered by finish date, so it is not draggable.
 */
export function TaskSections({ sections, groupBy, showProject = false, openDone = false, reorderable = null }: { sections: Section[]; groupBy: GroupKey; showProject?: boolean; openDone?: boolean; reorderable?: ReorderMode | null }) {
  const [toggled, setToggled] = useState(false);
  const showDone = openDone || toggled;

  if (sections.length === 0) return null;
  const scope = (list: Section["tasks"]): ReorderScope | undefined => (reorderable ? { list, mode: reorderable } : undefined);

  if (groupBy === "none") {
    return <div className="rows">{sections[0].tasks.map((t) => <TaskRow key={t.id} task={t} showProject={showProject} reorder={scope(sections[0].tasks)} />)}</div>;
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
              {showDone && <div className="rows">{sec.tasks.map((t) => <TaskRow key={t.id} task={t} showProject={showProject} />)}</div>}
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
            <div className="rows">{sec.tasks.map((t) => <TaskRow key={t.id} task={t} showProject={showProject} reorder={scope(sec.tasks)} />)}</div>
          </section>
        );
      })}
    </>
  );
}
