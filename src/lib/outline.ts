import { parse } from "../components/RichText";
import type { Person, Project, Task } from "./types";
import { formatTime, PRIORITIES, step, STATUSES } from "./util";

/**
 * A list of tasks laid out as an outline, for emails and Word documents.
 * Each task gets a number, a line of facts (project, due, priority, people), its details and its subtasks.
 */
export interface OutlineTask {
  title: string;
  done: boolean;
  facts: string[];
  /** Details, line by line, with their bullet or number and nesting level. */
  details: { level: number; mark: string; text: string }[];
  subtasks: OutlineTask[];
}

export interface Outline {
  title: string;
  /** Opening lines, such as a greeting. */
  intro: string[];
  tasks: OutlineTask[];
  /** Closing lines, such as the update link. */
  outro: string[];
}

export interface OutlineSource {
  kids(id: string): Task[];
  project(id: string | null): Project | undefined;
  assigned(taskId: string): Person[];
  contextLabel(id: string | null): string;
}

const MARKS = ["•", "◦", "▪"];

function due(t: Task): string | null {
  if (!t.due_date) return null;
  // Written out in full ("Sat, Nov 21"), since "Tomorrow" stops being true once the email sits in an inbox.
  const [y, m, d] = t.due_date.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  const label = day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
  return `Due ${label}${t.due_time ? ` at ${formatTime(t.due_time.slice(0, 5))}` : ""}`;
}

export function outlineTask(t: Task, src: OutlineSource, opts: { showProject: boolean; showPeople: boolean }, depth = 0): OutlineTask {
  const facts: string[] = [];
  const project = src.project(t.project_id);
  if (opts.showProject && depth === 0) facts.push(project ? `Project: ${project.name}` : "No project");
  const d = due(t);
  if (d) facts.push(d);
  if (t.priority !== "none") facts.push(`${PRIORITIES.find((p) => p.id === t.priority)?.label} priority`);
  if (step(t.status) !== "todo") facts.push(STATUSES.find((x) => x.id === step(t.status))!.label);
  if (t.context) facts.push(`Context: ${src.contextLabel(t.context)}`);
  const people = src.assigned(t.id);
  if (opts.showPeople && people.length) facts.push(`Assigned: ${people.map((p) => p.full_name).join(", ")}`);

  const details = (t.description ?? "").trim()
    ? parse(t.description!.replace(/\s+$/, "")).map((l) => {
        const level = Math.floor(l.indent / 2);
        return { level, mark: l.kind === "bullet" ? MARKS[Math.min(level, MARKS.length - 1)] : l.kind === "number" ? `${l.n}.` : "", text: l.text };
      })
    : [];

  return {
    title: t.title,
    done: t.status === "done",
    facts,
    details,
    subtasks: src.kids(t.id).map((k) => outlineTask(k, src, opts, depth + 1)),
  };
}

/** Plain text that reads well in any mail app: numbered tasks, indented facts, details and checkbox subtasks. */
export function outlineText(o: Outline): string {
  const out: string[] = [...o.intro];
  if (o.intro.length) out.push("");
  const sub = (k: OutlineTask, pad: string) => {
    out.push(`${pad}${k.done ? "[x]" : "[ ]"} ${k.title}${k.facts.length ? `  (${k.facts.join(", ")})` : ""}`);
    k.subtasks.forEach((g) => sub(g, pad + "    "));
  };
  o.tasks.forEach((t, i) => {
    out.push(`${i + 1}. ${t.title}`);
    const pad = " ".repeat(String(i + 1).length + 2);
    if (t.facts.length) out.push(`${pad}${t.facts.join(" · ")}`);
    if (t.details.length) {
      out.push(`${pad}Details:`);
      t.details.forEach((d) => out.push(`${pad}  ${"  ".repeat(d.level)}${d.mark ? `${d.mark} ` : ""}${d.text}`));
    }
    if (t.subtasks.length) {
      out.push(`${pad}Subtasks:`);
      t.subtasks.forEach((k) => sub(k, `${pad}  `));
    }
    out.push("");
  });
  if (o.tasks.length === 0) out.push("No open tasks right now.", "");
  out.push(...o.outro);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** A Word document of the outline. The docx library is loaded only when someone asks for one. */
export async function outlineDocx(o: Outline): Promise<Blob> {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const GREY = "5B6577";
  const body: InstanceType<typeof Paragraph>[] = [];

  body.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: o.title })] }));
  body.push(new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }), color: GREY })] }));
  o.intro.filter((l) => l.trim()).forEach((l) => body.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun(l)] })));

  const indent = (level: number) => ({ left: 360 + level * 360, hanging: 260 });
  const sub = (k: OutlineTask, level: number) => {
    body.push(
      new Paragraph({
        indent: indent(level),
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `${k.done ? "☑" : "☐"}  ` }),
          new TextRun({ text: k.title, strike: k.done }),
          ...(k.facts.length ? [new TextRun({ text: `   ${k.facts.join(" · ")}`, color: GREY, size: 18 })] : []),
        ],
      }),
    );
    k.subtasks.forEach((g) => sub(g, level + 1));
  };

  o.tasks.forEach((t, i) => {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 60 }, children: [new TextRun({ text: `${i + 1}. ${t.title}` })] }));
    if (t.facts.length) body.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: t.facts.join("  ·  "), color: GREY, size: 20 })] }));
    if (t.details.length) {
      body.push(new Paragraph({ spacing: { before: 60, after: 40 }, children: [new TextRun({ text: "Details", bold: true, size: 20 })] }));
      t.details.forEach((d) =>
        body.push(new Paragraph({ indent: d.mark ? indent(d.level) : { left: 360 + d.level * 360 }, spacing: { after: 40 }, children: [new TextRun({ text: d.mark ? `${d.mark}\t` : "" }), new TextRun(d.text)] })),
      );
    }
    if (t.subtasks.length) {
      body.push(new Paragraph({ spacing: { before: 60, after: 40 }, children: [new TextRun({ text: "Subtasks", bold: true, size: 20 })] }));
      t.subtasks.forEach((k) => sub(k, 0));
    }
  });
  if (o.tasks.length === 0) body.push(new Paragraph({ children: [new TextRun("No open tasks right now.")] }));
  o.outro.filter((l) => l.trim()).forEach((l) => body.push(new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.LEFT, children: [new TextRun({ text: l, color: GREY })] })));

  const doc = new Document({
    creator: "Task Manager",
    title: o.title,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ properties: {}, children: body }],
  });
  return Packer.toBlob(doc);
}

/** A file name from a title: letters, numbers and dashes only. */
export function fileName(title: string): string {
  return `${title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "tasks"}.docx`;
}

/** The outline for a set of tasks. */
export function buildOutline(
  src: OutlineSource,
  tasks: Task[],
  opts: { title: string; intro?: string[]; outro?: string[]; showProject: boolean; showPeople: boolean },
): Outline {
  return {
    title: opts.title,
    intro: opts.intro ?? [],
    outro: opts.outro ?? [],
    tasks: tasks.map((t) => outlineTask(t, src, opts)),
  };
}
