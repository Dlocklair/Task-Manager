import type { Task } from "./types";

/**
 * Links that put tasks into Google Calendar and Outlook.
 * A feed is a live subscription (the calendar app checks it every few hours).
 * The single-task links add one copy of a task, which does not change if the task changes later.
 */

export function webcal(url: string): string {
  return url.replace(/^https?:\/\//, "webcal://");
}

/** Opens Google Calendar's "Add calendar" screen with the feed filled in. */
export function googleSubscribe(feedUrl: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal(feedUrl))}`;
}

/** Opens Outlook on the web's "Subscribe from web" screen with the feed filled in. */
export function outlookSubscribe(feedUrl: string, name: string, work: boolean): string {
  const host = work ? "https://outlook.office.com" : "https://outlook.live.com";
  return `${host}/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent(name)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Start and end as local wall-clock times. A task with a due time is a 30-minute event; without one it is all day. */
function span(task: Task): { allDay: boolean; start: Date; end: Date } {
  const [y, m, d] = task.due_date!.split("-").map(Number);
  if (!task.due_time) return { allDay: true, start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
  const [h, min] = task.due_time.split(":").map(Number);
  const start = new Date(y, m - 1, d, h, min);
  return { allDay: false, start, end: new Date(start.getTime() + 30 * 60000) };
}

const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

function details(task: Task, project: string | null): string {
  const lines: string[] = [];
  if (project) lines.push(`Project: ${project}`);
  if (task.description?.trim()) lines.push(task.description.trim());
  lines.push("", "Added from Task Manager");
  return lines.join("\n");
}

export function googleEvent(task: Task, project: string | null): string {
  const { allDay, start, end } = span(task);
  const dates = allDay ? `${task.due_date!.replace(/-/g, "")}/${nextDay(task.due_date!).replace(/-/g, "")}` : `${utcStamp(start)}/${utcStamp(end)}`;
  const q = new URLSearchParams({ action: "TEMPLATE", text: task.title, dates, details: details(task, project) });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function outlookEvent(task: Task, project: string | null, work: boolean): string {
  const { allDay, start, end } = span(task);
  const host = work ? "https://outlook.office.com" : "https://outlook.live.com";
  const q = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: task.title,
    startdt: allDay ? task.due_date! : localIso(start),
    enddt: allDay ? nextDay(task.due_date!) : localIso(end),
    allday: String(allDay),
    body: details(task, project),
  });
  return `${host}/calendar/0/deeplink/compose?${q.toString()}`;
}

function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** A one-event .ics file, for Apple Calendar, Outlook on a computer, or anything else. */
export function downloadIcs(task: Task, project: string | null): void {
  const { allDay, start, end } = span(task);
  const ymd = (day: string) => day.replace(/-/g, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Task Manager//Task//EN",
    "BEGIN:VEVENT",
    `UID:${task.id}@task-manager`,
    `DTSTAMP:${utcStamp(new Date())}`,
    ...(allDay ? [`DTSTART;VALUE=DATE:${ymd(task.due_date!)}`, `DTEND;VALUE=DATE:${ymd(nextDay(task.due_date!))}`] : [`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`]),
    `SUMMARY:${esc(task.title)}`,
    `DESCRIPTION:${esc(details(task, project))}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${task.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "task"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
