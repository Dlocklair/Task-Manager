import { useState, type FormEvent } from "react";
import { Bookmark, X } from "lucide-react";
import { useStore } from "../lib/store";
import { DEFAULT_CONFIG, GROUP_OPTIONS, isChanged, normalise, SORT_OPTIONS, sameConfig } from "../lib/listing";
import type { GroupKey, ListConfig } from "../lib/types";
import { PRIORITIES } from "../lib/util";

interface Props {
  /** "all" for All tasks, or a project id. Saved filters are kept per scope. */
  scope: string;
  cfg: ListConfig;
  onChange(cfg: ListConfig): void;
  /** Grouping choices offered here. Empty hides the Group by control. */
  groups: GroupKey[];
  showProject: boolean;
  shown: number;
  total: number;
}

export function ListTools({ scope, cfg, onChange, groups, showProject, shown, total }: Props) {
  const s = useStore();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const set = <K extends keyof ListConfig>(key: K, value: ListConfig[K]) => onChange({ ...cfg, [key]: value });
  const people = [...s.data.people].sort((a, b) => a.full_name.localeCompare(b.full_name));
  const saved = s.data.savedFilters.filter((f) => f.scope === scope);
  const applied = saved.find((f) => sameConfig(normalise(f.config), cfg));
  const changed = isChanged(cfg);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    s.addSavedFilter(n, scope, cfg);
    setName("");
    setNaming(false);
  };

  return (
    <>
      <div className="view-tools" role="group" aria-label="Filter, group and sort tasks">
        <label>
          <span>Assigned to</span>
          <select value={cfg.who} onChange={(e) => set("who", e.target.value)}>
            <option value="all">Everyone</option>
            <option value="none">Nobody yet</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select value={cfg.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="all">Any priority</option>
            {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {showProject && (
          <label>
            <span>Project</span>
            <select value={cfg.project} onChange={(e) => set("project", e.target.value)}>
              <option value="all">All projects</option>
              {s.data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        {groups.length > 0 && (
          <label>
            <span>Group by</span>
            <select value={cfg.groupBy} onChange={(e) => set("groupBy", e.target.value as GroupKey)}>
              {GROUP_OPTIONS.filter((g) => groups.includes(g.id)).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </label>
        )}
        <label>
          <span>Sort by</span>
          <select value={cfg.sortBy} onChange={(e) => set("sortBy", e.target.value as ListConfig["sortBy"])}>
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="check-inline">
          <input type="checkbox" checked={cfg.hideDone} onChange={(e) => set("hideDone", e.target.checked)} />
          Hide done
        </label>
        {changed && <button className="btn small" onClick={() => onChange(DEFAULT_CONFIG)}>Reset</button>}
        <span className="view-count">Showing {shown} of {total}</span>
      </div>

      <div className="saved-bar" aria-label="Saved filters">
        <span className="saved-label"><Bookmark size={15} />Saved</span>
        {saved.length === 0 && !naming && <span className="saved-empty">Set the filters you use often, then save them here.</span>}
        {saved.map((f) => (
          <span key={f.id} className={"saved-chip" + (applied?.id === f.id ? " on" : "")}>
            <button className="saved-apply" aria-pressed={applied?.id === f.id} onClick={() => onChange(normalise(f.config))}>{f.name}</button>
            <button className="saved-x" aria-label={`Delete saved filter ${f.name}`} onClick={() => s.deleteSavedFilter(f.id)}><X size={13} /></button>
          </span>
        ))}
        {changed && !naming && <button className="btn small" onClick={() => setNaming(true)}>Save these filters</button>}
        {naming && (
          <form className="saved-form" onSubmit={save}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this filter" aria-label="Filter name" maxLength={60} />
            <button className="btn primary small" type="submit" disabled={!name.trim()}>Save</button>
            <button className="btn small" type="button" onClick={() => { setNaming(false); setName(""); }}>Cancel</button>
          </form>
        )}
      </div>
    </>
  );
}
