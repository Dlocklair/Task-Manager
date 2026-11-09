import type { PriorityKey, StatusKey } from "./types";

export interface StatusDef {
  key: StatusKey;
  label: string;
  /** HSL triplet for tints */
  hsl: string;
  /** text-safe color on the dark surfaces */
  text: string;
}

export const STATUSES: StatusDef[] = [
  { key: "todo", label: "To do", hsl: "270 70% 66%", text: "hsl(270 70% 72%)" },
  { key: "progress", label: "In progress", hsl: "210 90% 62%", text: "hsl(210 90% 66%)" },
  { key: "review", label: "In review", hsl: "330 75% 62%", text: "hsl(330 75% 68%)" },
  { key: "done", label: "Done", hsl: "150 60% 45%", text: "hsl(150 60% 52%)" },
];

export const statusDef = (key: StatusKey) => STATUSES.find((s) => s.key === key) ?? STATUSES[0];

export interface PriorityDef {
  key: PriorityKey;
  label: string;
  level: 1 | 2 | 3 | 4;
  text: string;
  bg: string;
}

/** Only Urgent and High carry color, so color is reserved for what needs attention. */
export const PRIORITIES: PriorityDef[] = [
  { key: "urgent", label: "Urgent", level: 4, text: "hsl(0 84% 66%)", bg: "hsl(0 84% 60% / 0.15)" },
  { key: "high", label: "High", level: 3, text: "hsl(30 92% 58%)", bg: "hsl(30 92% 55% / 0.15)" },
  { key: "medium", label: "Medium", level: 2, text: "hsl(240 10% 85%)", bg: "hsl(240 6% 20%)" },
  { key: "low", label: "Low", level: 1, text: "hsl(240 5% 64%)", bg: "hsl(240 6% 15%)" },
];

export const priorityDef = (key: PriorityKey) => PRIORITIES.find((p) => p.key === key) ?? PRIORITIES[2];

/** Project palette — distinct hues that read on the dark surface. */
export const PROJECT_COLORS: { name: string; hsl: string }[] = [
  { name: "Cyan", hsl: "191 80% 58%" },
  { name: "Gold", hsl: "41 91% 56%" },
  { name: "Coral", hsl: "12 85% 66%" },
  { name: "Lime", hsl: "95 55% 55%" },
  { name: "Indigo", hsl: "235 80% 72%" },
  { name: "Rose", hsl: "345 80% 68%" },
  { name: "Teal", hsl: "168 65% 48%" },
  { name: "Orchid", hsl: "290 60% 68%" },
];

export const STORAGE_KEY = "task-manager:v1";
