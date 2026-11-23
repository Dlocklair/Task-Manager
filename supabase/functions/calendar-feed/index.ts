// Serves a calendar feed (iCalendar) of tasks with due dates, for Google Calendar, Outlook and Apple Calendar.
// The address is https://<project>.supabase.co/functions/v1/calendar-feed?token=<feed token>
// The token is the only key: calendar apps can't sign in, so this function is deployed with JWT checks off
// and asks the database (public.calendar_feed) for the feed that matches the token.

type FeedTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string;
  due_time: string | null;
  remind_before_minutes: number | null;
  project: string | null;
  parent_title: string | null;
  people: string[];
};

type Feed = { workspace: string; person: string | null; timezone: string; tasks: FeedTask[] };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "";

const PRIORITY: Record<string, string> = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low", none: "No priority" };
const STATUS: Record<string, string> = { todo: "To do", in_progress: "In progress", blocked: "In progress", review: "In progress", done: "Done" };

/** Text values in iCalendar escape backslashes, semicolons, commas and line breaks. */
function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 bytes are folded onto continuation lines that start with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: string) => d.replaceAll("-", "");

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

/** How far (in ms) the time zone is ahead of UTC at a given moment. */
function zoneOffset(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - at.getTime();
}

/** A wall-clock date and time in the feed's time zone, as a UTC moment. */
function toUtc(day: string, time: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let tz = timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = "UTC";
  }
  const first = guess - zoneOffset(new Date(guess), tz);
  // Run it twice so moments near a daylight-saving change land right.
  return new Date(guess - zoneOffset(new Date(first), tz));
}

const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

function event(t: FeedTask, tz: string, now: string): string[] {
  const done = t.status === "done";
  const lines = ["BEGIN:VEVENT", `UID:${t.id}@task-manager`, `DTSTAMP:${now}`];
  let start: Date | null = null;
  if (t.due_time) {
    start = toUtc(t.due_date, t.due_time.slice(0, 5), tz);
    lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 30 * 60000))}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${ymd(t.due_date)}`, `DTEND;VALUE=DATE:${nextDay(t.due_date)}`);
  }
  lines.push(`SUMMARY:${esc((done ? "✓ " : "") + t.title)}`);

  const about: string[] = [];
  if (t.project) about.push(`Project: ${t.project}`);
  if (t.parent_title) about.push(`Part of: ${t.parent_title}`);
  about.push(`Status: ${STATUS[t.status] ?? t.status}`, `Priority: ${PRIORITY[t.priority] ?? t.priority}`);
  if (t.people.length) about.push(`Assigned to: ${t.people.join(", ")}`);
  if (t.description?.trim()) about.push("", t.description.trim());
  if (APP_URL) about.push("", `Open in Task Manager: ${APP_URL}`);
  lines.push(`DESCRIPTION:${esc(about.join("\n"))}`);
  if (t.project) lines.push(`CATEGORIES:${esc(t.project)}`);
  // Tasks don't block time on your calendar.
  lines.push("TRANSP:TRANSPARENT");

  if (!done && t.remind_before_minutes !== null && t.remind_before_minutes >= 0) {
    // All-day tasks are due at 9:00 AM in the app, so the reminder counts back from then.
    const before = t.due_time ? t.remind_before_minutes : t.remind_before_minutes - 9 * 60;
    const trigger = before >= 0 ? `-PT${before}M` : `PT${-before}M`;
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(t.title)}`, `TRIGGER:${trigger}`, "END:VALARM");
  }
  lines.push("END:VEVENT");
  return lines;
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{32,80}$/.test(token)) return new Response("Calendar feed not found", { status: 404 });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/calendar_feed`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
  });
  if (!res.ok) return new Response("The calendar feed could not be loaded right now", { status: 502 });
  const feed = (await res.json()) as Feed | null;
  if (!feed) return new Response("This calendar feed has been turned off", { status: 404 });

  const name = feed.person ? `Tasks: ${feed.person}` : `Tasks: ${feed.workspace}`;
  const now = stamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Task Manager//Calendar feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    `X-WR-TIMEZONE:${esc(feed.timezone)}`,
    // Ask calendar apps to check again every hour. Google and Outlook decide for themselves how often they really do.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...feed.tasks.flatMap((t) => event(t, feed.timezone, now)),
    "END:VCALENDAR",
  ];

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="tasks.ics"',
      "Cache-Control": "no-store",
    },
  });
});
