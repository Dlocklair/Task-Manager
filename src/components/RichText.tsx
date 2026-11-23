import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { IndentDecrease, IndentIncrease, List, ListOrdered, Pencil } from "lucide-react";

// Notes and details are stored as plain text. Lines starting with "- " are bullets,
// "1. " are numbers, and two spaces of indent per level nest them. Nothing extra to store.

type Kind = "text" | "bullet" | "number";
export interface Line { indent: number; kind: Kind; text: string; n: number }

const BULLET = /^( *)[-*•] (.*)$/;
const NUMBER = /^( *)(\d{1,3})[.)] (.*)$/;

function classify(raw: string): Omit<Line, "n"> {
  const b = raw.match(BULLET);
  if (b) return { indent: b[1].length, kind: "bullet", text: b[2] };
  const n = raw.match(NUMBER);
  if (n) return { indent: n[1].length, kind: "number", text: n[3] };
  const indent = raw.length - raw.trimStart().length;
  return { indent, kind: "text", text: raw.slice(indent) };
}

/** Parse every line and work out the number for each numbered line, restarting after other lines at that level. */
export function parse(value: string): Line[] {
  const counters: number[] = [];
  return value.split("\n").map((raw) => {
    const c = classify(raw);
    const level = Math.floor(c.indent / 2);
    for (let i = level + 1; i < counters.length; i++) counters[i] = 0;
    if (c.kind === "number") counters[level] = (counters[level] ?? 0) + 1;
    else counters[level] = 0;
    return { ...c, n: counters[level] ?? 0 };
  });
}

/** Rewrite numbered lines so their numbers run in order. */
export function normalize(value: string): string {
  const parsed = parse(value);
  return value
    .split("\n")
    .map((raw, i) => {
      const l = parsed[i];
      const pad = " ".repeat(l.indent);
      if (l.kind === "number") return `${pad}${l.n}. ${l.text}`;
      if (l.kind === "bullet") return `${pad}- ${l.text}`;
      return raw;
    })
    .join("\n");
}

const MARKS = ["•", "◦", "▪"];

/** Shows the formatted version of a note or detail. */
export function RichView({ text }: { text: string }) {
  return (
    <div className="rt-view">
      {parse(text).map((l, i) => {
        const level = Math.floor(l.indent / 2);
        const mark = l.kind === "bullet" ? MARKS[Math.min(level, MARKS.length - 1)] : l.kind === "number" ? `${l.n}.` : "";
        return (
          <div key={i} className={"rt-line" + (l.kind === "text" ? " plain" : "")} style={{ paddingLeft: level * 24 }}>
            {mark && <span className="rt-mark" aria-hidden="true">{mark}</span>}
            <span className="rt-text">{l.text || " "}</span>
          </div>
        );
      })}
    </div>
  );
}

function rangeOfLines(value: string, start: number, end: number): [number, number] {
  const first = value.slice(0, start).split("\n").length - 1;
  const last = value.slice(0, Math.max(start, end)).split("\n").length - 1;
  return [first, last];
}

interface RichEditorProps {
  value: string;
  onChange(v: string): void;
  rows?: number;
  placeholder?: string;
  ariaLabel: string;
  onKeyDown?(e: KeyboardEvent<HTMLTextAreaElement>): void;
  onBlur?(): void;
  footer?: ReactNode;
  autoFocus?: boolean;
}

/** Textarea with list tools. Enter continues a list, Tab and Shift+Tab indent it. */
export function RichEditor({ value, onChange, rows = 4, placeholder, ariaLabel, onKeyDown, onBlur, footer, autoFocus }: RichEditorProps) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<[number, number] | null>(null);

  useLayoutEffect(() => {
    if (pending.current && ta.current) {
      const [a, b] = pending.current;
      ta.current.setSelectionRange(a, b);
      pending.current = null;
    }
  }, [value]);

  const sel = () => [ta.current?.selectionStart ?? value.length, ta.current?.selectionEnd ?? value.length] as const;

  const commit = (next: string, a: number, b = a) => {
    pending.current = [a, b];
    onChange(next);
  };

  /** Apply a change to every selected line and report the new selection. */
  const editLines = (fn: (raw: string, kind: Kind) => string) => {
    const [start, end] = sel();
    const lines = value.split("\n");
    const [first, last] = rangeOfLines(value, start, end);
    const kinds = parse(value);
    for (let i = first; i <= last; i++) lines[i] = fn(lines[i], kinds[i].kind);
    const next = normalize(lines.join("\n"));
    const startOfFirst = lines.slice(0, first).join("\n").length + (first > 0 ? 1 : 0);
    const endOfLast = next.split("\n").slice(0, last + 1).join("\n").length;
    // With no selection, leave the cursor at the end of the line so typing continues it.
    if (start === end) commit(next, endOfLast);
    else commit(next, startOfFirst, endOfLast);
  };

  const toggleList = (kind: "bullet" | "number") => {
    const [start, end] = sel();
    const [first, last] = rangeOfLines(value, start, end);
    const kinds = parse(value).slice(first, last + 1);
    const allSame = kinds.every((k) => k.kind === kind);
    editLines((raw) => {
      const c = classify(raw);
      const pad = " ".repeat(c.indent);
      if (allSame) return pad + c.text;
      return pad + (kind === "bullet" ? "- " : "1. ") + c.text;
    });
  };

  const indentBy = (delta: 1 | -1) =>
    editLines((raw) => {
      if (delta > 0) return "  " + raw;
      const spaces = raw.match(/^ */)?.[0].length ?? 0;
      return raw.slice(Math.min(2, spaces));
    });

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const [start, end] = sel();
    if (start !== end) {
      if (e.key === "Tab") {
        e.preventDefault();
        indentBy(e.shiftKey ? -1 : 1);
      }
      return;
    }
    const lineIdx = value.slice(0, start).split("\n").length - 1;
    const parsed = parse(value)[lineIdx];
    if (!parsed) return;

    if (e.key === "Tab" && parsed.kind !== "text") {
      e.preventDefault();
      indentBy(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && parsed.kind !== "text") {
      e.preventDefault();
      const lines = value.split("\n");
      const pad = " ".repeat(parsed.indent);
      if (parsed.text.trim() === "") {
        // An empty item ends the list.
        lines[lineIdx] = "";
        const next = lines.join("\n");
        const at = lines.slice(0, lineIdx).join("\n").length + (lineIdx > 0 ? 1 : 0);
        commit(next, at);
        return;
      }
      const prefix = parsed.kind === "bullet" ? `${pad}- ` : `${pad}${parsed.n + 1}. `;
      const next = value.slice(0, start) + "\n" + prefix + value.slice(start);
      commit(next, start + 1 + prefix.length);
    }
  };

  const toolbarBtn = (label: string, icon: ReactNode, onClick: () => void) => (
    <button
      type="button"
      className="rt-tool"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </button>
  );

  return (
    <div className="rt-editor">
      <div className="rt-toolbar" role="toolbar" aria-label="Formatting">
        {toolbarBtn("Bulleted list", <List size={17} />, () => toggleList("bullet"))}
        {toolbarBtn("Numbered list", <ListOrdered size={17} />, () => toggleList("number"))}
        <span className="rt-sep" aria-hidden="true" />
        {toolbarBtn("Indent", <IndentIncrease size={17} />, () => indentBy(1))}
        {toolbarBtn("Outdent", <IndentDecrease size={17} />, () => indentBy(-1))}
      </div>
      <textarea
        ref={ta}
        className="rt-input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        onBlur={onBlur}
      />
      {footer}
    </div>
  );
}

/** Formatted text that turns into an editor when clicked. Used for task details. */
export function RichField({ value, label, placeholder, onSave, startEditing = false }: { value: string; label: string; placeholder: string; onSave(v: string | null): void; startEditing?: boolean }) {
  // startEditing: opened from a folded section with nothing in it yet, so go straight to typing.
  const [editing, setEditing] = useState(startEditing && !value.trim());
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const finish = () => {
    const v = normalize(draft).trim();
    setEditing(false);
    if (v !== value.trim()) onSave(v || null);
  };

  if (editing) {
    return (
      <RichEditor
        value={draft}
        onChange={setDraft}
        rows={6}
        placeholder={placeholder}
        ariaLabel={label}
        autoFocus
        onBlur={finish}
        footer={
          <div className="rt-footer">
            <span>Tip: Enter continues a list, Tab indents it.</span>
            <button type="button" className="btn small primary" onMouseDown={(e) => e.preventDefault()} onClick={finish}>Done</button>
          </div>
        }
      />
    );
  }

  if (!value.trim()) {
    return (
      <button type="button" className="rt-empty" onClick={() => setEditing(true)}>
        <Pencil size={14} />{placeholder}
      </button>
    );
  }

  return (
    <div
      className="rt-box"
      role="button"
      tabIndex={0}
      aria-label={`Edit ${label}`}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setEditing(true))}
    >
      <RichView text={value} />
      <span className="rt-edit-hint"><Pencil size={13} />Edit</span>
    </div>
  );
}
