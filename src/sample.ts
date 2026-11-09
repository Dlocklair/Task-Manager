import type { AppData, PriorityKey, Project, StatusKey, Task } from "./types";
import { addDays, todayIso, uid } from "./utils";

/** Sample workspace so the app isn't empty on first open. Dates are relative to today. */
export function sampleData(): AppData {
  const now = Date.now();
  const today = todayIso();
  const p = (name: string, color: string): Project => ({ id: uid(), name, color, createdAt: now });
  const web = p("Website relaunch", "191 80% 58%");
  const q4 = p("Q4 planning", "41 91% 56%");
  const hire = p("Hiring", "12 85% 66%");
  const office = p("Office move", "95 55% 55%");
  const client = p("Client onboarding", "235 80% 72%");

  const t = (
    project: Project,
    title: string,
    status: StatusKey,
    priority: PriorityKey,
    dueOffset: number | null,
    owner: string,
    description: string,
    subs: [string, boolean][] = [],
    notes: string[] = [],
  ): Task => ({
    id: uid(),
    projectId: project.id,
    title,
    description,
    status,
    priority,
    due: dueOffset === null ? "" : addDays(today, dueOffset),
    owner,
    subtasks: subs.map(([title, done]) => ({ id: uid(), title, done })),
    notes: notes.map((text, i) => ({ id: uid(), text, createdAt: now - (notes.length - i) * 3_600_000 })),
    createdAt: now,
    completedAt: status === "done" ? now : null,
  });

  return {
    version: 1,
    projects: [web, q4, hire, office, client],
    tasks: [
      t(web, "Finalize homepage wireframes", "progress", "high", 0, "Priya Shah",
        "Lock the desktop and mobile layouts so engineering can start the build sprint.",
        [["Hero section", true], ["Pricing table", true], ["Footer links", false]],
        ["Stakeholders approved the hero direction.", "Pricing table needs the annual toggle."]),
      t(web, "Write launch announcement copy", "todo", "medium", 4, "Sam Chen",
        "Short post for the blog and a matching email to existing customers.",
        [["Blog post draft", false], ["Email version", false]]),
      t(web, "QA checkout flow on mobile", "review", "urgent", -3, "Jordan Lee",
        "Test payment, address and confirmation steps on iOS and Android before sign-off.",
        [["iOS Safari", true], ["Android Chrome", true], ["Saved cards", true], ["Promo codes", false]],
        ["Promo code field clears on back navigation — logged as a bug."]),
      t(q4, "Draft Q4 budget forecast", "progress", "urgent", 1, "David L.",
        "Roll up department estimates into one forecast for the leadership review.",
        [["Pull actuals", true], ["Department estimates", false], ["Summary slide", false]]),
      t(q4, "Collect department headcount requests", "todo", "high", -4, "Alex Rivera",
        "Each lead submits planned hires and backfills for next quarter."),
      t(q4, "Review vendor contracts", "review", "medium", 3, "David L.",
        "Check renewal dates and pricing changes on the three largest vendors.",
        [["Software licenses", true], ["Facilities", true]]),
      t(hire, "Schedule interviews for design lead", "progress", "medium", 2, "Priya Shah",
        "Book panel interviews with the four shortlisted candidates.",
        [["Shortlist confirmed", true], ["Panel availability", false], ["Send invites", false]]),
      t(hire, "Post senior engineer job listing", "done", "low", -5, "Alex Rivera",
        "Listing is live on the careers page and two job boards.",
        [["Final description", true], ["Publish", true]]),
      t(office, "Book movers and confirm date", "todo", "high", 0, "Jordan Lee",
        "Get two quotes, pick one and confirm the move-in weekend with the landlord."),
      t(office, "Plan desk layout for new floor", "todo", "low", 11, "Sam Chen",
        "Group desks by team and leave space for two meeting rooms."),
      t(client, "Send welcome kit to Northwind", "done", "medium", -3, "Priya Shah",
        "Kit shipped with login details and the getting-started guide."),
      t(client, "Set up onboarding call series", "review", "high", 0, "David L.",
        "Three 30-minute calls covering setup, reporting and admin settings.",
        [["Agenda", true], ["Calendar holds", false]]),
      t(client, "Update FAQ for new customers", "done", "low", -6, "Sam Chen",
        "Added answers on billing, data export and user roles."),
    ],
  };
}

export function emptyData(): AppData {
  return {
    version: 1,
    projects: [{ id: uid(), name: "General", color: "191 80% 58%", createdAt: Date.now() }],
    tasks: [],
  };
}
