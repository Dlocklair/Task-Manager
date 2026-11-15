import { Check as CheckIcon } from "lucide-react";
import { useStore } from "../lib/store";
import { Avatar } from "./ui";

/** A checklist of everyone in the workspace. Ticking a box adds or removes that person from `value`. */
export function PeoplePicks({ value, onChange, label }: { value: string[]; onChange(ids: string[]): void; label: string }) {
  const s = useStore();
  const people = [...s.data.people].sort((a, b) => a.full_name.localeCompare(b.full_name));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="pick-list-box" role="group" aria-label={label}>
      {people.map((p) => {
        const on = value.includes(p.id);
        return (
          <label key={p.id} className={"picker-row" + (on ? " on" : "")}>
            <input type="checkbox" className="pick-box-input" checked={on} onChange={() => toggle(p.id)} />
            <span className="pick-box" aria-hidden="true">{on && <CheckIcon size={14} strokeWidth={3.2} />}</span>
            <Avatar person={p} size={24} />
            <span className="picker-name">
              {p.full_name}
              {p.user_id === s.data.userId && <em>You</em>}
            </span>
          </label>
        );
      })}
      {people.length === 0 && <p className="picker-none">Add people first, then choose who gets new tasks by default.</p>}
    </div>
  );
}
