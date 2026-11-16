import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { applyLook, LookSection } from "./LookEditor";

/** Layout and type settings. Saved in this browser and applied to every screen. */
export interface Tweaks {
  bodyFont: "figtree" | "system" | "serif";
  displayFont: "bricolage" | "figtree" | "serif";
  lineHeight: number;
  rowSpacing: number;
  pageWidth: "880" | "1080" | "1280" | "full";
  radius: number;
  accent: "blue" | "teal" | "violet" | "graphite";
  textScale: number;
}

export const DEFAULT_TWEAKS: Tweaks = {
  bodyFont: "figtree",
  displayFont: "bricolage",
  lineHeight: 1.45,
  rowSpacing: 11,
  pageWidth: "1080",
  radius: 12,
  accent: "blue",
  textScale: 1,
};

const BODY: Record<Tweaks["bodyFont"], string> = {
  figtree: '"Figtree Variable", system-ui, -apple-system, "Segoe UI", sans-serif',
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};
const DISPLAY: Record<Tweaks["displayFont"], string> = {
  bricolage: '"Bricolage Grotesque Variable", "Figtree Variable", system-ui, sans-serif',
  figtree: '"Figtree Variable", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};
const ACCENT: Record<Tweaks["accent"], [string, string, string]> = {
  blue: ["#3157e0", "#2443bd", "#e9eeff"],
  teal: ["#0b8478", "#086a60", "#e3f5f3"],
  violet: ["#6f47d0", "#5836ab", "#efeafb"],
  graphite: ["#2b3446", "#1c2332", "#e8ebf1"],
};
const WIDTH: Record<Tweaks["pageWidth"], string> = { "880": "880px", "1080": "1080px", "1280": "1280px", full: "none" };

const KEY = "task-manager-tweaks";
const ON_KEY = "task-manager-tweaks-on";

/**
 * The panel is for the owner only. Open the app once with ?tweaks=1 in each browser to show it,
 * and ?tweaks=0 to hide it again. Beta testers never see it.
 */
export function tweaksEnabled(): boolean {
  try {
    const flag = new URLSearchParams(window.location.search).get("tweaks");
    if (flag === "1") localStorage.setItem(ON_KEY, "1");
    if (flag === "0") localStorage.removeItem(ON_KEY);
    return localStorage.getItem(ON_KEY) === "1";
  } catch {
    return false;
  }
}

export function loadTweaks(): Tweaks {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_TWEAKS, ...(JSON.parse(raw) as Partial<Tweaks>) };
  } catch {
    // Bad saved settings fall back to the defaults.
  }
  return DEFAULT_TWEAKS;
}

/** Writes the settings into CSS variables on the page root. */
export function applyTweaks(t: Tweaks) {
  const root = document.documentElement.style;
  const [primary, dark, soft] = ACCENT[t.accent];
  root.setProperty("--body", BODY[t.bodyFont]);
  root.setProperty("--display", DISPLAY[t.displayFont]);
  root.setProperty("--lh", String(t.lineHeight));
  root.setProperty("--row-y", `${t.rowSpacing}px`);
  root.setProperty("--page-w", WIDTH[t.pageWidth]);
  root.setProperty("--r", `${t.radius}px`);
  root.setProperty("--ts", String(t.textScale));
  root.setProperty("--r-lg", `${t.radius + 6}px`);
  root.setProperty("--primary", primary);
  root.setProperty("--primary-dark", dark);
  root.setProperty("--primary-soft", soft);
}

function save(t: Tweaks) {
  localStorage.setItem(KEY, JSON.stringify(t));
  applyTweaks(t);
}

/** Applied as soon as the app loads, so the saved look is there from the first paint. */
export function applySavedTweaks() {
  if (tweaksEnabled()) {
    applyTweaks(loadTweaks());
    applyLook();
  }
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange(v: T): void }) {
  return (
    <div className="tweaks-group">
      <span>{label}</span>
      <div className="tweaks-seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" className={value === o.id ? "on" : ""} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

export function TweaksPanel() {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState<Tweaks>(loadTweaks);
  const set = <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
    const next = { ...t, [key]: value };
    setT(next);
    save(next);
  };
  const reset = () => {
    setT(DEFAULT_TWEAKS);
    save(DEFAULT_TWEAKS);
  };

  if (!open) {
    return (
      <button className="tweaks-toggle" onClick={() => setOpen(true)} aria-expanded={false}>
        <SlidersHorizontal size={16} />Tweaks
      </button>
    );
  }

  return (
    <aside className="tweaks-panel" aria-label="Tweaks">
      <div className="tweaks-head">
        <h2>Tweaks</h2>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close tweaks"><X size={18} /></button>
      </div>

      <LookSection />

      <div className="tweaks-sample" style={{ fontFamily: BODY[t.bodyFont], lineHeight: t.lineHeight }}>
        <strong style={{ fontFamily: DISPLAY[t.displayFont] }}>Sample task heading</strong>
        <span>Body text sits here at the chosen line spacing. Rows and buttons follow the same settings.</span>
      </div>

      <Seg
        label="Body font"
        value={t.bodyFont}
        onChange={(v) => set("bodyFont", v)}
        options={[{ id: "figtree", label: "Figtree" }, { id: "system", label: "System" }, { id: "serif", label: "Serif" }]}
      />
      <Seg
        label="Heading font"
        value={t.displayFont}
        onChange={(v) => set("displayFont", v)}
        options={[{ id: "bricolage", label: "Bricolage" }, { id: "figtree", label: "Figtree" }, { id: "serif", label: "Serif" }]}
      />

      <label className="tweaks-group">
        <span>Text size: {Math.round(t.textScale * 100)}%</span>
        <input type="range" min={0.9} max={1.2} step={0.05} value={t.textScale} onChange={(e) => set("textScale", Number(e.target.value))} />
      </label>
      <label className="tweaks-group">
        <span>Line spacing: {t.lineHeight.toFixed(2)}</span>
        <input type="range" min={1.2} max={2} step={0.05} value={t.lineHeight} onChange={(e) => set("lineHeight", Number(e.target.value))} />
      </label>
      <label className="tweaks-group">
        <span>Row spacing: {t.rowSpacing}px</span>
        <input type="range" min={6} max={20} step={1} value={t.rowSpacing} onChange={(e) => set("rowSpacing", Number(e.target.value))} />
      </label>
      <label className="tweaks-group">
        <span>Corner roundness: {t.radius}px</span>
        <input type="range" min={0} max={20} step={1} value={t.radius} onChange={(e) => set("radius", Number(e.target.value))} />
      </label>

      <Seg
        label="Content width"
        value={t.pageWidth}
        onChange={(v) => set("pageWidth", v)}
        options={[{ id: "880", label: "Narrow" }, { id: "1080", label: "Standard" }, { id: "1280", label: "Wide" }, { id: "full", label: "Full" }]}
      />

      <div className="tweaks-group">
        <span>Accent colour</span>
        <div className="tweaks-swatches" role="group" aria-label="Accent colour">
          {(Object.keys(ACCENT) as Tweaks["accent"][]).map((k) => (
            <button key={k} type="button" aria-label={k} className={t.accent === k ? "on" : ""} aria-pressed={t.accent === k} style={{ background: ACCENT[k][0] }} onClick={() => set("accent", k)} />
          ))}
        </div>
      </div>

      <button className="btn" type="button" onClick={reset}>Reset to defaults</button>
    </aside>
  );
}
