import type { Project, Task } from "../types";
import { Avatar, DueBadge, PriorityLabel, StatusPill } from "./bits";

interface Props {
  tasks: Task[];
  projects: Project[];
  selectedTaskId: string | null;
  onSelect: (id: string) => void;
}

export function ListView({ tasks, projects, selectedTaskId, onSelect }: Props) {
  const projectOf = (id: string) => projects.find((p) => p.id === id);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col" style={{ paddingLeft: 16 }}>Task</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">Project</th>
            <th scope="col">Due</th>
            <th scope="col">Subtasks</th>
            <th scope="col">Owner</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const p = projectOf(t.projectId);
            const done = t.subtasks.filter((s) => s.done).length;
            return (
              <tr key={t.id} className={t.id === selectedTaskId ? "selected" : undefined}>
                <td style={{ paddingLeft: 16 }}>
                  <button
                    type="button"
                    className="row-title"
                    onClick={() => onSelect(t.id)}
                    style={t.status === "done" ? { textDecoration: "line-through", color: "hsl(var(--muted-foreground))" } : undefined}
                  >
                    {t.title}
                  </button>
                </td>
                <td><StatusPill status={t.status} /></td>
                <td><PriorityLabel priority={t.priority} /></td>
                <td>
                  {p && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, whiteSpace: "nowrap" }}>
                      <span className="project-swatch" style={{ background: `hsl(${p.color})`, width: 9, height: 9 }} />
                      {p.name}
                    </span>
                  )}
                </td>
                <td><DueBadge task={t} /></td>
                <td className="meta">{t.subtasks.length ? `${done}/${t.subtasks.length}` : "—"}</td>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, whiteSpace: "nowrap" }}>
                    <Avatar name={t.owner} />
                    {t.owner || <span className="muted">Unassigned</span>}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {tasks.length === 0 && <div className="meta" style={{ padding: 32, textAlign: "center" }}>No tasks match these filters.</div>}
    </div>
  );
}
