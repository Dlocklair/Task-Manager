import { useState } from "react";
import { useStore } from "../lib/store";
import { ALL_BASE, applyFilters, countTotal, groupTasks, NO_SEARCH, normalise, rememberSort, reorderMode, withSavedSort, type TextSearch } from "../lib/listing";
import type { GroupKey, ListConfig } from "../lib/types";
import { ListTools } from "./ListTools";
import { SearchBox } from "./SearchBox";
import { TaskSections } from "./TaskSections";
import { TopActions } from "./TopActions";
import { Empty } from "./ui";

const ALL_GROUPS: GroupKey[] = ["status", "assigned", "priority", "due", "project", "none"];

/** Every open or finished task across all projects. Subtasks sit under their parent. */
export function AllTasks({ filterId }: { filterId?: string }) {
  const s = useStore();
  // Opened from a saved filter in the sidebar: start with that filter applied.
  const [cfg, setCfg] = useState<ListConfig>(() => {
    const f = filterId ? s.data.savedFilters.find((x) => x.id === filterId) : undefined;
    return f ? normalise(f.config, ALL_BASE) : withSavedSort(ALL_BASE, "all");
  });
  const [search, setSearch] = useState<TextSearch>(NO_SEARCH);
  const roots = s.data.tasks.filter((t) => !t.parent_task_id);
  const ctx = { people: s.data.people, projects: s.data.projects, contexts: s.contexts, assigned: (id: string) => s.assigned(id) };
  const tasks = applyFilters(roots, cfg, ctx, search);
  const sections = groupTasks(tasks, cfg, ctx);
  const open = roots.filter((t) => t.status !== "done").length;

  return (
    <div className="page">
      <header className="page-head page-head-stack">
        <div className="page-head-row">
          <h1>All tasks</h1>
          <TopActions />
        </div>
        <div className="page-head-row">
          <p className="date-line">{open === 0 ? "Nothing open in any project" : `${open} open task${open === 1 ? "" : "s"} across ${s.data.projects.length} project${s.data.projects.length === 1 ? "" : "s"}`}</p>
          <SearchBox
            value={search.q}
            onChange={(q) => setSearch({ ...search, q })}
            includeClosed={search.includeClosed}
            onIncludeClosed={(includeClosed) => setSearch({ ...search, includeClosed })}
            placeholder="Search all tasks"
          />
        </div>
      </header>

      {roots.length > 0 && (
        <ListTools scope="all" cfg={cfg} base={ALL_BASE} onChange={(c) => { rememberSort("all", c.sortBy); setCfg(c); }} search={search} onSearch={setSearch} groups={ALL_GROUPS} showProject showSearch={false} shown={tasks.length} total={countTotal(roots, cfg, search)} />
      )}

      {roots.length === 0 ? (
        <Empty title="No tasks yet">Add a task with the New task button. It will appear here.</Empty>
      ) : tasks.length === 0 ? (
        <Empty title="No tasks match">Clear the search or filters above to see more.</Empty>
      ) : (
        <TaskSections sections={sections} groupBy={cfg.groupBy} showProject={cfg.groupBy !== "project"} openDone={search.includeClosed && search.q.trim().length > 0} reorderable={reorderMode(cfg.sortBy)} />
      )}
    </div>
  );
}
