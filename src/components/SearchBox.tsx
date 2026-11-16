import { Search, X } from "lucide-react";

/** Text search with an opt-in for closed tasks. Closed tasks stay out of results unless the box is ticked. */
export function SearchBox({
  value,
  onChange,
  includeClosed,
  onIncludeClosed,
  placeholder,
  className = "",
}: {
  value: string;
  onChange(v: string): void;
  includeClosed: boolean;
  onIncludeClosed(v: boolean): void;
  placeholder: string;
  className?: string;
}) {
  const on = value.trim().length > 0;
  return (
    <div className={`search-box ${className}`.trim()}>
      <label className={"check-inline" + (includeClosed ? " is-set" : "")}>
        <input type="checkbox" checked={includeClosed} onChange={(e) => onIncludeClosed(e.target.checked)} />
        Include closed
      </label>
      <label className={"search" + (on ? " is-set" : "")}>
        <Search size={16} />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        {on && (
          <button type="button" className="search-clear" aria-label="Clear search" onClick={() => onChange("")}>
            <X size={14} />
          </button>
        )}
      </label>
    </div>
  );
}
