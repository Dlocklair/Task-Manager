import { useState, type FormEvent } from "react";
import { Bookmark, X } from "lucide-react";
import { useStore } from "../lib/store";
import { activeFilters, GROUP_OPTIONS, isChanged, normalise, SORT_OPTIONS, sameConfig, type TextSearch } from "../lib/listing";
import type { GroupKey, ListConfig } from "../lib/types";
import { CONTEXTS, PRIORITIES } from "../lib/util";
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
  /**
   * A project page shows its own search at the top of this panel, with Hide completed on the line under it.
   * All tasks has its search in the page header instead, so Hide completed stays with Group/Sort.
   */
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

  // Context sits after Priority on a project page, and after Project on All tasks.
  const contextField = (
    <label data-ctl="context">
      <span>Context</span>
      <select className={hot("context")} value={cfg.context} onChange={(e) => set("context", e.target.value)}>
        <option value="all">Any context</option>
        <option value="none">No context</option>
        {CONTEXTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </label>
  );

  // On a project page the count sits on the Hide completed line, so Sort by can end the Group/Sort block.
  const count = <span className="view-count">Showing {shown} of {total}</span>;

  const hideCompleted = (
    <label className="check-inline">
      <input type="checkbox" checked={cfg.hideDone} onChange={(e) => set("hideDone", e.target.checked)} />
      Hide completed
    </label>
  );

  return (
    <div className={"filter-box" + (showSearch ? "" : " grid-layout")} aria-label="Filters">
      {showSearch && (
        <div className="filter-top">
          <SearchBox
            value={search.q}
            onChange={(q) => onSearch({ ...search, q })}
            includeClosed={search.includeClosed}
            onIncludeClosed={(includeClosed) => onSearch({ ...search, includeClosed })}
            placeholder="Search this project"
          />
        </div>
      )}
      {showSearch && <div className="filter-hide">{hideCompleted}{count}</div>}

      <div className="filter-groups">
        <section className="filter-group" aria-label="Filter">
          <h3 className="filter-heading">Filter</h3>
          <div className="view-tools" role="group" aria-label="Filter tasks">
            <label data-ctl="who">
              <span>Assigned to</span>
              <select className={hot("who")} value={cfg.who} onChange={(e) => set("who", e.target.value)}>
                <option value="all">Everyone</option>
                <option value="none">Nobody yet</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </label>
            <label data-ctl="priority">
              <span>Priority</span>
              <select className={hot("priority")} value={cfg.priority} onChange={(e) => set("priority", e.target.value)}>
                <option value="all">Any priority</option>
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            {!showProject && contextField}
            {showProject && (
              <label data-ctl="project">
                <span>Project</span>
                <select className={hot("project")} value={cfg.project} onChange={(e) => set("project", e.target.value)}>
                  <option value="all">All projects</option>
                  {s.data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            {showProject && contextField}
          </div>
        </section>

        <section className="filter-group" aria-label="Group and sort">
          <h3 className="filter-heading">Group/Sort</h3>
          <div className="view-tools" role="group" aria-label="Group and sort tasks">
            {groups.length > 0 && (
              <label data-ctl="group">
                <span>Group by</span>
                <select className={hot("groupBy")} value={cfg.groupBy} onChange={(e) => set("groupBy", e.target.value as GroupKey)}>
                  {GROUP_OPTIONS.filter((g) => groups.includes(g.id)).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </label>
            )}
            <label data-ctl="sort">
              <span>Sort by</span>
              <select className={hot("sortBy")} value={cfg.sortBy} onChange={(e) => set("sortBy", e.target.value as ListConfig["sortBy"])}>
                {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            {!showSearch && hideCompleted}
            {!showSearch && count}
          </div>
        </section>
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
