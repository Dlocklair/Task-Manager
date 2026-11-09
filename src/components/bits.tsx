import { AlertTriangle, Calendar, CheckCircle2, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PriorityKey, Project, StatusKey, Task } from "../types";
import { STATUSES, priorityDef, statusDef } from "../constants";
import { daysFromToday, shortDate } from "../utils";

export function PriorityBars({ priority, size = 14 }: { priority: PriorityKey; size?: number }) {
  const p = priorityDef(priority);
  const off = "hsl(240 6% 28%)";
  const fill = (n: number) => (p.level >= n ? p.text : off);
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="11" width="2.5" height="4" rx="1" fill={fill(1)} />
      <rect x="5" y="8" width="2.5" height="7" rx="1" fill={fill(2)} />
      <rect x="9" y="5" width="2.5" height="10" rx="1" fill={fill(3)} />
      <rect x="13" y="2" width="2.5" height="13" rx="1" fill={fill(4)} />
    </svg>
  );
}

export function PriorityLabel({ priority }: { priority: PriorityKey }) {
  const p = priorityDef(priority);
  return (
    <span className="prio" style={{ color: p.text }} title={`${p.label} priority`}>
      <PriorityBars priority={priority} />
      {p.label}
    </span>
  );
}

export function ProjectPill({ project }: { project?: Project }) {
  if (!project) return <span className="project-pill muted">No project</span>;
  return (
    <span className="project-pill" style={{ background: `hsl(${project.color} / 0.14)`, color: `hsl(${project.color})` }}>
      <span className="sq" style={{ background: `hsl(${project.color})` }} />
      {project.name}
    </span>
  );
}

export function StatusPill({ status }: { status: StatusKey }) {
  const s = statusDef(status);
  return (
    <span className="status-pill" style={{ background: `hsl(${s.hsl} / 0.15)`, color: s.text }}>
      <span className="status-dot" style={{ width: 7, height: 7, background: s.text }} />
      {s.label}
    </span>
  );
}

export interface DueInfo {
  label: string;
  fg: string;
  bg: string;
  Icon: LucideIcon;
  kind: "none" | "done" | "late" | "today" | "soon" | "later";
}

export function dueInfo(task: Task): DueInfo {
  const neutral = { fg: "hsl(var(--muted-foreground))", bg: "hsl(var(--secondary))" };
  if (task.status === "done") {
    return { label: "Done", fg: "hsl(150 60% 52%)", bg: "hsl(150 60% 45% / 0.12)", Icon: CheckCircle2, kind: "done" };
  }
  if (!task.due) return { label: "No date", ...neutral, Icon: Calendar, kind: "none" };
  const d = daysFromToday(task.due);
  if (d < 0)
    return { label: `${-d} ${d === -1 ? "day" : "days"} late`, fg: "hsl(0 84% 68%)", bg: "hsl(0 84% 60% / 0.15)", Icon: AlertTriangle, kind: "late" };
  if (d === 0) return { label: "Due today", fg: "hsl(38 92% 58%)", bg: "hsl(38 92% 50% / 0.15)", Icon: Clock, kind: "today" };
  if (d === 1) return { label: "Tomorrow", fg: "hsl(240 10% 85%)", bg: neutral.bg, Icon: Calendar, kind: "soon" };
  if (d <= 7) return { label: `In ${d} days`, ...neutral, Icon: Calendar, kind: "soon" };
  return { label: shortDate(task.due), ...neutral, Icon: Calendar, kind: "later" };
}

export function DueBadge({ task }: { task: Task }) {
  const info = dueInfo(task);
  return (
    <span className="due" style={{ color: info.fg, background: info.bg }}>
      <info.Icon size={13} aria-hidden="true" />
      {info.label}
    </span>
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function Avatar({ name }: { name: string }) {
  if (!name) return null;
  return (
    <span className="avatar" title={name} aria-label={name}>
      {initials(name)}
    </span>
  );
}

/** Status as a drop-down, colored to match the status. */
export function StatusSelect({
  status,
  onChange,
  id,
  compact = false,
  label = "Status",
}: {
  status: StatusKey;
  onChange: (s: StatusKey) => void;
  id?: string;
  compact?: boolean;
  label?: string;
}) {
  const s = statusDef(status);
  return (
    <span className={"status-select" + (compact ? " compact" : "")} style={{ ["--s" as string]: s.hsl, ["--st" as string]: s.text }}>
      <span className="status-dot" style={{ background: s.text }} aria-hidden="true" />
      <select id={id} aria-label={id ? undefined : label} value={status} onChange={(e) => onChange(e.target.value as StatusKey)}>
        {STATUSES.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </span>
  );
}
