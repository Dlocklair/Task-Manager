import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, LogOut, Plus, X } from "lucide-react";
import { useStore } from "../lib/store";
import type { ContextDef } from "../lib/types";
import { uid } from "../lib/util";

/** Settings for the whole workspace. Contexts first; more settings can sit here later. */
export function SettingsPage({ onSignOut }: { onSignOut?: () => void }) {
  const s = useStore();
  return (
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <section className="settings-card" aria-labelledby="ctx-head">
        <h2 id="ctx-head">Contexts</h2>
        <p className="field-hint">
          Contexts say where or how a task can be done, such as at the computer or while running errands. Rename them, add your own, remove ones you don't use, and put them in the order you want. The order here is the order in every menu.
        </p>
        <ContextEditor />
      </section>

      <section className="settings-card" aria-labelledby="acct-head">
        <h2 id="acct-head">Account</h2>
        <p className="field-hint">
          {s.api.demo ? "Sample data. Nothing is saved." : s.api.local ? "Saved on this device only." : `Signed in as ${s.data.email}.`}
        </p>
        {onSignOut && (
          <button className="btn" onClick={onSignOut}><LogOut size={16} />{s.api.local ? "Leave device-only mode" : "Sign out"}</button>
        )}
      </section>
    </div>
  );
}

function ContextEditor() {
  const s = useStore();
  const [label, setLabel] = useState("");
  const list = s.contexts;
  const usage = (id: string) => s.data.tasks.filter((t) => t.context === id).length;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const l = label.trim();
    if (!l) return;
    if (list.some((c) => c.label.toLowerCase() === l.toLowerCase())) {
      s.toast(`"${l}" is already in the list.`);
      return;
    }
    s.setContexts([...list, { id: uid(), label: l }]);
    setLabel("");
  };

  const move = (i: number, by: -1 | 1) => {
    const next = [...list];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    s.setContexts(next);
  };

  return (
    <>
      {list.length === 0 && <p className="field-hint">No contexts yet. Add one below.</p>}
      <ul className="ctx-list">
        {list.map((c, i) => (
          <ContextRow
            key={c.id}
            context={c}
            count={usage(c.id)}
            first={i === 0}
            last={i === list.length - 1}
            onRename={(l) => s.setContexts(list.map((x) => (x.id === c.id ? { ...x, label: l } : x)))}
            onMove={(by) => move(i, by)}
            onRemove={() => {
              const n = usage(c.id);
              const msg = n ? `Remove "${c.label}"? ${n} task${n === 1 ? "" : "s"} using it will be left with no context.` : `Remove "${c.label}"?`;
              if (window.confirm(msg)) s.removeContext(c.id);
            }}
          />
        ))}
      </ul>
      <form className="form-inline" onSubmit={add}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New context, such as Office" aria-label="New context name" maxLength={60} />
        <button className="btn primary" type="submit" disabled={!label.trim()}><Plus size={16} />Add context</button>
      </form>
    </>
  );
}

function ContextRow({ context, count, first, last, onRename, onMove, onRemove }: {
  context: ContextDef;
  count: number;
  first: boolean;
  last: boolean;
  onRename(label: string): void;
  onMove(by: -1 | 1): void;
  onRemove(): void;
}) {
  const [label, setLabel] = useState(context.label);
  const commit = () => {
    const l = label.trim();
    if (!l) setLabel(context.label);
    else if (l !== context.label) onRename(l);
  };
  return (
    <li className="ctx-row">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        aria-label={`Name for ${context.label}`}
        maxLength={60}
      />
      <span className="ctx-count">{count} task{count === 1 ? "" : "s"}</span>
      <button type="button" className="icon-btn" disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${context.label} up`}><ArrowUp size={16} /></button>
      <button type="button" className="icon-btn" disabled={last} onClick={() => onMove(1)} aria-label={`Move ${context.label} down`}><ArrowDown size={16} /></button>
      <button type="button" className="icon-btn danger" onClick={onRemove} aria-label={`Remove ${context.label}`}><X size={16} /></button>
    </li>
  );
}
