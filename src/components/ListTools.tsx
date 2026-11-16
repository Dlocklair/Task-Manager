import { useState, type FormEvent } from "react";
import { Bookmark, X } from "lucide-react";
import { useStore } from "../lib/store";
import { activeFilters, GROUP_OPTIONS, isChanged, normalise, SORT_OPTIONS, sameConfig, type TextSearch } from "../lib/listing";
import type { GroupKey, ListConfig } from "../lib/types";
import { PRIORITIES } from "../lib/util";
import { SearchBox } from "./SearchBox";

interface Props {
  /** "all" for All tasks, or a project id. Saved filters are kept per scope. */
  scope: string;
  cfg: ListConfig;
  /** The settings this view opens with. Anything different from these counts as a filter. */
  base: ListConfig;
  onChange(cfg: ListConfig): void;
  search: TextSearch;
  onSearch(s: TextSearch): void;
  /** Grouping choices offered here. Empty hides the Group by control. */
  groups: GroupKey[];
  showProject: boolean;
  /** Show the search box inside the filter panel. Pages that place search in their header turn this off. */
  showSearch?: boolean;
  shown: number;
  total: number;
}

export function ListTools({ scope, cfg, base, onChange, search, onSearch, groups, showProject, showSearch = true, shown, total }: Props) {
  const s = useStore();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const set = <K extends keyof ListConfig>(key: K, value: ListConfig[K]) => onChange({ ...cfg, [key]: value });
  const people = [...s.data.people].sort((a, b) => a.full_name.localeCompare(b.full_name));
  const saved = s.data.savedFilters.filter((f) => f.scope === scope);
  const ctx = { people: s.data.people, projects: s.data.projects, assigned: (id: string) => s.assigned(id) };
  const applied = saved.find((f) => sameConfig(normalise(f.config, base), cfg));
  const active = activeFilters(cfg, base, ctx, search);
  // Searches are not saved, so only the settings decide whether there is something to save.
  const changed = isChanged(cfg, base);
  // A highlighted control is one that differs from the view's starting setting.
  const hot = (key: keyof ListConfig) => (cfg[key] !== base[key] ? " is-set" : "");

  const save = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    s.addSavedFilter(n, scope, cfg);
    setName("");
    setNaming(false);
  };

  const reset = () => {
    onChange(base);
    onSearch({ q: "", includeClosed: false });
  };

  return (
    <div className="filter-box" aria-label="Filters">
      {showSearch && (
        <SearchBox
          value={search.q}
          onChange={(q) => onSearch({ ...search, q })}
          includeClosed={search.includeClosed}
          onIncludeClosed={(includeClosed) => onSearch({ ...search, includeClosed })}
          placeholder={scope === "all" ? "Search all tasks" : "Search this project"}
        />
      )}

      <div className="view-tools" role="group" aria-label="Filter, group and sort tasks">
        <label>
          <span>Assigned to</span>
          <select className={hot("who")} value={cfg.who} onChange={(e) => set("who", e.target.value)}>
            <option value="all">Everyone</option>
            <option value="none">Nobody yet</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select className={hot("priority")} value={cfg.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="all">Any priority</option>
            {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {showProject && (
          <label>
            <span>Project</span>
            <select className={hot("project")} value={cfg.project} onChange={(e) => set("project", e.target.value)}>
              <option value="all">All projects</option>
              {s.data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        {groups.length > 0 && (
          <label>
            <span>Group by</span>
            <select className={hot("groupBy")} value={cfg.groupBy} onChange={(e) => set("groupBy", e.target.value as GroupKey)}>
              {GROUP_OPTIONS.filter((g) => groups.includes(g.id)).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </label>
        )}
        <label>
          <span>Sort by</span>
          <select className={hot("sortBy")} value={cfg.sortBy} onChange={(e) => set("sortBy", e.target.value as ListConfig["sortBy"])}>
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="check-inline">
          <input type="checkbox" checked={cfg.hideDone} onChange={(e) => set("hideDone", e.target.checked)} />
          Hide completed
        </label>
        <span className="view-count">Showing {shown} of {total}</span>
      </div>

      {active.length > 0 && (
        <div className="active-bar" aria-label="Active filters">
          <span className="active-label">Active</span>
          {active.map((a) => <span key={a} className="active-chip">{a}</span>)}
          <button className="btn small" onClick={reset}>Clear all</button>
        </div>
      )}

      <div className="saved-bar" aria-label="Saved filters">
        <span className="saved-label"><Bookmark size={15} />Saved</span>
        {saved.map((f) => (
          <span key={f.id} className={"saved-chip" + (applied?.id === f.id ? " on" : "")}>
            <button className="saved-apply" aria-pressed={applied?.id === f.id} onClick={() => onChange(normalise(f.config, base))}>{f.name}</button>
            <button className="saved-x" aria-label={`Delete saved filter ${f.name}`} onClick={() => s.deleteSavedFilter(f.id)}><X size={13} /></button>
          </span>
        ))}
        {saved.length === 0 && !naming && <span className="saved-empty">Set the filters you use often, then save them here.</span>}
        {changed && !naming && <button className="saved-save" onClick={() => setNaming(true)}>Save these filters</button>}
        {naming && (
          <form className="saved-form" onSubmit={save}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this filter" aria-label="Filter name" maxLength={60} />
            <button className="btn primary small" type="submit" disabled={!name.trim()}>Save</button>
            <button className="btn small" type="button" onClick={() => { setNaming(false); setName(""); }}>Cancel</button>
          </form>
        )}
      </div>
    </div>
  );
}
