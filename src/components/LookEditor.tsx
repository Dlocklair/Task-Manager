import { useEffect, useState, useSyncExternalStore } from "react";

/** Look-only changes to individual boxes, keyed by a selector path from .app. Owner-only; see tweaksEnabled. */
export type Overrides = Record<string, Record<string, string>>;

const KEY = "task-manager-look";
const STYLE_ID = "tw-look-overrides";
const PANEL = ".tweaks-panel, .tweaks-toggle";

let overrides: Overrides = readOverrides();
let editing = false;
let version = 0;
let hovered: HTMLElement | null = null;
let selected: { el: HTMLElement; sel: string } | null = null;
const listeners = new Set<() => void>();

function readOverrides(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Overrides;
  } catch {
    return {};
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  version++;
  listeners.forEach((l) => l());
}

export function cssFor(o: Overrides): string {
  return Object.entries(o)
    .filter(([, d]) => Object.keys(d).length > 0)
    .map(([sel, d]) => `${sel} {\n${Object.entries(d).map(([p, v]) => `  ${p}: ${v};`).join("\n")}\n}`)
    .join("\n\n");
}

function writeStyle() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = cssFor(overrides);
}

function commit(next: Overrides) {
  overrides = next;
  localStorage.setItem(KEY, JSON.stringify(overrides));
  writeStyle();
  drawBoxes();
  notify();
}

/** Applied on load, so saved changes show from the first paint. */
export function applyLook() {
  writeStyle();
}

/** Returns a selector path for the element, or null if it is outside the app. */
export function selectorFor(el: HTMLElement): string | null {
  const app = document.querySelector<HTMLElement>(".app");
  if (!app || !app.contains(el)) return null;
  const parts: string[] = [];
  for (let cur: HTMLElement | null = el; cur && cur !== app; cur = cur.parentElement) {
    const tag = cur.tagName.toLowerCase();
    const classes = Array.from(cur.classList)
      .filter((c) => !c.startsWith("tw-"))
      .map((c) => `.${CSS.escape(c)}`)
      .join("");
    const index = cur.parentElement ? Array.from(cur.parentElement.children).indexOf(cur) + 1 : 1;
    parts.unshift(`${tag}${classes}:nth-child(${index})`);
  }
  return [".app", ...parts].join(" > ");
}

export function setLook(sel: string, prop: string, value: string | null) {
  const current = { ...(overrides[sel] ?? {}) };
  if (value === null) delete current[prop];
  else current[prop] = value;
  const next = { ...overrides };
  if (Object.keys(current).length) next[sel] = current;
  else delete next[sel];
  commit(next);
}

/** Moves the selection up to the box that contains the current one. */
export function selectParent() {
  const parent = selected?.el.parentElement;
  if (!parent || !parent.closest(".app") || parent.matches(".app")) return;
  const sel = selectorFor(parent);
  if (!sel) return;
  selected = { el: parent, sel };
  drawBoxes();
  notify();
}

export function clearBox(sel: string) {
  const next = { ...overrides };
  delete next[sel];
  commit(next);
}

export function clearAll() {
  commit({});
}

function ensureBox(id: string, color: string, border: string) {
  let box = document.getElementById(id);
  if (!box) {
    box = document.createElement("div");
    box.id = id;
    Object.assign(box.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "9998",
      border: `2px ${border} ${color}`,
      borderRadius: "6px",
      boxSizing: "border-box",
      display: "none",
    });
    document.body.appendChild(box);
  }
  return box;
}

function place(box: HTMLElement, el: HTMLElement | null) {
  if (!el || !el.isConnected) {
    box.style.display = "none";
    return;
  }
  const r = el.getBoundingClientRect();
  Object.assign(box.style, { display: "block", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
}

function drawBoxes() {
  const hoverBox = ensureBox("tw-hover-box", "#3157e0", "dashed");
  const selBox = ensureBox("tw-sel-box", "#e0572f", "solid");
  if (!editing) {
    place(hoverBox, null);
    place(selBox, null);
    return;
  }
  place(hoverBox, hovered);
  place(selBox, selected?.el ?? null);
}

function inPanel(t: HTMLElement) {
  return Boolean(t.closest(PANEL));
}

function onMove(e: MouseEvent) {
  const t = e.target as HTMLElement;
  hovered = !inPanel(t) && document.querySelector(".app")?.contains(t) ? t : null;
  drawBoxes();
}

function onClick(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (inPanel(t)) return;
  e.preventDefault();
  e.stopPropagation();
  const sel = selectorFor(t);
  if (!sel) return;
  selected = { el: t, sel };
  drawBoxes();
  notify();
}

function onViewport() {
  drawBoxes();
}

export function setEditing(on: boolean) {
  if (on === editing) return;
  editing = on;
  if (on) {
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onViewport, true);
    window.addEventListener("resize", onViewport);
  } else {
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("scroll", onViewport, true);
    window.removeEventListener("resize", onViewport);
    hovered = null;
    selected = null;
  }
  drawBoxes();
  notify();
}

const num = (v: number) => (Number.isFinite(v) ? Math.round(v) : "");

function Inspector({ sel, el }: { sel: string; el: HTMLElement }) {
  const mine = overrides[sel] ?? {};
  const cs = getComputedStyle(el);
  const shown = (prop: string, computed: string) => (mine[prop] ? parseFloat(mine[prop]) : parseFloat(computed));
  const [x, y] = (mine.translate ?? "0px 0px").split(" ").map((v) => parseFloat(v) || 0);
  const text = el.textContent?.trim().slice(0, 40) || el.tagName.toLowerCase();
  // Moving needs a box that transforms, and size needs a box that is not stretched by its parent.
  // Plain inline text and flex children that grow ignore these, so adjust them first.
  const ensureBlockBox = () => {
    if (cs.display === "inline" && !mine.display) setLook(sel, "display", "inline-block");
  };
  const ensureSized = () => {
    ensureBlockBox();
    if (!mine.flex) setLook(sel, "flex", "none");
  };

  const sizeField = (label: string, prop: string, computed: string) => (
    <label className="tweaks-group">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        value={num(shown(prop, computed))}
        onChange={(e) => {
          const v = e.target.value;
          if (prop === "width" || prop === "height") ensureSized();
          if (v === "") setLook(sel, prop, null);
          else setLook(sel, prop, `${Number(v)}px`);
        }}
      />
    </label>
  );

  const moveField = (label: string, axis: "x" | "y") => (
    <label className="tweaks-group">
      <span>{label}</span>
      <input
        type="number"
        value={axis === "x" ? x : y}
        onChange={(e) => {
          const v = Number(e.target.value) || 0;
          ensureBlockBox();
          const nx = axis === "x" ? v : x;
          const ny = axis === "y" ? v : y;
          setLook(sel, "translate", nx || ny ? `${nx}px ${ny}px` : null);
        }}
      />
    </label>
  );

  return (
    <div className="tweaks-look-box">
      <p className="tweaks-hint">Selected: “{text}”</p>
      {sizeField("Width (px)", "width", cs.width)}
      {sizeField("Height (px)", "height", cs.height)}
      {sizeField("Text size (px)", "font-size", cs.fontSize)}
      {moveField("Move across (px, + right)", "x")}
      {moveField("Move down (px, + down)", "y")}
      <div className="tweaks-row">
        <button className="btn" type="button" onClick={selectParent}>Select parent box</button>
        <button className="btn" type="button" onClick={() => clearBox(sel)}>Reset this box</button>
      </div>
    </div>
  );
}

/** Edit-boxes section of the Tweaks panel. */
export function LookSection() {
  useSyncExternalStore(subscribe, () => version);
  const [copied, setCopied] = useState(false);
  useEffect(() => () => setEditing(false), []);

  const on = editing;
  const count = Object.keys(overrides).length;
  const css = cssFor(overrides);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the CSS is still shown in the box below to copy by hand.
    }
  };

  return (
    <section className="tweaks-look" aria-label="Edit boxes">
      <div className="tweaks-group">
        <span>Edit boxes</span>
        <button type="button" className={on ? "btn primary" : "btn"} aria-pressed={on} onClick={() => setEditing(!on)}>
          {on ? "Stop selecting" : "Select a box"}
        </button>
        <p className="tweaks-hint">
          {on ? "Click any box on the page. Changes apply as you go." : "Turn this on, then click a box on the page to change it."}
        </p>
      </div>

      {on && selected && selected.el.isConnected && <Inspector sel={selected.sel} el={selected.el} />}

      {count > 0 && (
        <div className="tweaks-group">
          <span>Your changes ({count} {count === 1 ? "box" : "boxes"})</span>
          <textarea className="tweaks-css" readOnly value={css} aria-label="CSS for your changes" onFocus={(e) => e.target.select()} />
          <div className="tweaks-row">
            <button className="btn" type="button" onClick={copy}>{copied ? "Copied" : "Copy CSS"}</button>
            <button className="btn" type="button" onClick={() => clearAll()}>Clear all changes</button>
          </div>
        </div>
      )}
    </section>
  );
}
