import { outlineTask, type OutlineSource, type OutlineTask } from "./outline";
import type { Task } from "./types";

/** One block of the printout, such as a status or person group. title is empty for an ungrouped list. */
export interface PrintSection {
  title: string;
  tasks: Task[];
}

export interface PrintJob {
  title: string;
  /** Plain-language lines about what the list shows, such as "Assigned to: Maria". */
  filters: string[];
  sections: PrintSection[];
  showProject: boolean;
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function subtaskHtml(k: OutlineTask): string {
  return `<li class="ps-sub${k.done ? " done" : ""}"><span class="ps-box">${k.done ? "&#9745;" : "&#9744;"}</span><span class="ps-sub-title">${esc(k.title)}</span>${
    k.facts.length ? `<span class="ps-sub-facts">${esc(k.facts.join(" · "))}</span>` : ""
  }${k.subtasks.length ? `<ul>${k.subtasks.map(subtaskHtml).join("")}</ul>` : ""}</li>`;
}

function taskHtml(t: OutlineTask, path: string): string {
  const details = t.details.length
    ? `<div class="ps-details">${t.details
        .map((d) => `<div style="padding-left:${d.level * 16}px">${d.mark ? `<span class="ps-mark">${esc(d.mark)}</span>` : ""}${esc(d.text)}</div>`)
        .join("")}</div>`
    : "";
  const subs = t.subtasks.length ? `<ul class="ps-subs">${t.subtasks.map(subtaskHtml).join("")}</ul>` : "";
  return `<li class="ps-task${t.done ? " done" : ""}"><div class="ps-line"><span class="ps-box">${t.done ? "&#9745;" : "&#9744;"}</span><div><div class="ps-title">${
    path ? `<span class="ps-path">${esc(path)} › </span>` : ""
  }${esc(t.title)}</div>${t.facts.length ? `<div class="ps-facts">${esc(t.facts.join("  ·  "))}</div>` : ""}${details}${subs}</div></div></li>`;
}

/** The printable page for a list, as HTML. */
export function printHtml(job: PrintJob, src: OutlineSource & { ancestors(id: string): Task[] }): string {
  const count = job.sections.reduce((n, s) => n + s.tasks.length, 0);
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const head = `<header class="ps-head"><h1>${esc(job.title)}</h1><p>${esc(date)} · ${count} task${count === 1 ? "" : "s"}</p>${
    job.filters.length ? `<p class="ps-filters">${job.filters.map(esc).join(" &nbsp;·&nbsp; ")}</p>` : ""
  }</header>`;
  const body = job.sections
    .filter((sec) => sec.tasks.length)
    .map((sec) => {
      const items = sec.tasks
        .map((t) => taskHtml(outlineTask(t, src, { showProject: job.showProject, showPeople: true }), t.parent_task_id ? src.ancestors(t.id).map((a) => a.title).join(" › ") : ""))
        .join("");
      return `<section class="ps-group">${sec.title ? `<h2>${esc(sec.title)} <span>${sec.tasks.length}</span></h2>` : ""}<ol class="ps-tasks">${items}</ol></section>`;
    })
    .join("");
  return head + (count ? body : `<p>No tasks to print.</p>`);
}

/**
 * Prints a list. The page is laid into a sheet the app hides on screen, and only that sheet is printed,
 * so the printout has no menus or buttons. Works the same from a computer, iPad or phone.
 */
export function printList(job: PrintJob, src: OutlineSource & { ancestors(id: string): Task[] }) {
  document.getElementById("print-sheet")?.remove();
  const sheet = document.createElement("div");
  sheet.id = "print-sheet";
  sheet.innerHTML = printHtml(job, src);
  document.body.appendChild(sheet);
  document.documentElement.classList.add("printing");
  const prevTitle = document.title;
  // The title becomes the file name when saving the printout as a PDF.
  document.title = job.title;
  const done = () => {
    document.documentElement.classList.remove("printing");
    document.title = prevTitle;
    sheet.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  // Let the sheet lay out before the print dialog opens.
  setTimeout(() => window.print(), 50);
}
