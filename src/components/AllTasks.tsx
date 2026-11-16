import { useState } from "react";
import { useStore } from "../lib/store";
import { applyFilters, DEFAULT_CONFIG, groupTasks } from "../lib/listing";
import type { GroupKey, ListConfig } from "../lib/types";
import { ListTools } from "./ListTools";
import { TaskSections } from "./TaskSections";
import { Empty } from "./ui";

const ALL_GROUPS: GroupKey[] = ["status", "assigned", "priority", "due", "project", "none"];

/** Every open or finished task across all projects. Subtasks sit under their parent. */
export function AllTasks() {
  const s = useStore();
  const [cfg, setCfg] = useState<ListConfig>({ ...DEFAULT_CONFIG, groupBy: "project" });
  const roots = s.data.tasks.filter((t) => !t.parent_task_id);
  const ctx = { people: s.data.people, projects: s.data.projects, assigned: (id: string) => s.assigned(id) };
  const tasks = applyFilters(roots, cfg, ctx);
  const sections = groupTasks(tasks, cfg, ctx);
  const open = roots.filter((t) => t.status !== "done").length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>All tasks</h1>
          <p className="date-line">{open === 0 ? "Nothing open in any project" : `${open} open task${open === 1 ? "" : "s"} across ${s.data.projects.length} project${s.data.projects.length === 1 ? "" : "s"}`}</p>
        </div>
      </header>

      {roots.length > 0 && (
        <ListTools scope="all" cfg={cfg} onChange={setCfg} groups={ALL_GROUPS} showProject shown={tasks.length} total={roots.length} />
      )}

      {roots.length === 0 ? (
        <Empty title="No tasks yet">Add a task with the New task button. It will appear here.</Empty>
      ) : tasks.length === 0 ? (
        <Empty title="No tasks match this filter">Reset the filters above to see all of them.</Empty>
      ) : (
        <TaskSections sections={sections} groupBy={cfg.groupBy} showProject={cfg.groupBy !== "project"} />
      )}
    </div>
  );
}
