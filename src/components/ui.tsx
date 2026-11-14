import { useEffect, type ReactNode } from "react";
import { Calendar, Check as CheckIcon, Flag, X } from "lucide-react";
import type { Person, Priority, Task } from "../lib/types";
import { dueLabel, dueTone, initials, PRIORITIES, tint } from "../lib/util";

export function Avatar({ person, size = 26 }: { person: Person; size?: number }) {
  return (
    <span className="avatar" style={{ ...tint(person.color), width: size, height: size, fontSize: size * 0.4 }} title={person.full_name}>
      {initials(person.full_name)}
    </span>
  );
}

export function AvatarStack({ people }: { people: Person[] }) {
  if (!people.length) return null;
  return (
    <span className="avatar-stack">
      {people.slice(0, 3).map((p) => <Avatar key={p.id} person={p} size={24} />)}
      {people.length > 3 && <span className="avatar more">+{people.length - 3}</span>}
    </span>
  );
}

export function Check({ done, onToggle, label }: { done: boolean; onToggle(): void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Reopen ${label}` : `Complete ${label}`}
      className={"check" + (done ? " on" : "")}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {done && <CheckIcon size={13} strokeWidth={3.2} />}
    </button>
  );
}

export function DueBadge({ task }: { task: Task }) {
  if (!task.due_date) return null;
  const tone = task.status === "done" ? "later" : dueTone(task.due_date);
  return (
    <span className={`due ${tone}`}>
      <Calendar size={12} />
      {dueLabel(task.due_date)}
      {tone === "late" && <span className="sr-only"> (overdue)</span>}
    </span>
  );
}

export function PriorityFlag({ priority, withLabel }: { priority: Priority; withLabel?: boolean }) {
  if (priority === "none" || (priority === "low" && !withLabel)) return null;
  const label = PRIORITIES.find((p) => p.id === priority)!.label;
  return (
    <span className={`prio ${priority}`} title={`${label} priority`}>
      <Flag size={13} fill="currentColor" />
      {withLabel ? label : <span className="sr-only">{label} priority</span>}
    </span>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

export function Swatches({ value, onChange, colors }: { value: string; onChange(c: string): void; colors: string[] }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Color">
      {colors.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={`Color ${c}`} className={"swatch" + (value === c ? " on" : "")} style={tint(c)} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}
