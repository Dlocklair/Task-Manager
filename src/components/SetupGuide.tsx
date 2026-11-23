import type { ReactNode } from "react";
import { Check as CheckIcon } from "lucide-react";
import { useStore } from "../lib/store";
import type { View } from "../lib/types";

interface Step {
  title: string;
  done: boolean;
  optional?: boolean;
  body: ReactNode;
  action?: { label: string; go: View; anchor?: string };
}

/** A walkthrough of getting set up: people, defaults, projects, calendars, filters and the phone/tablet app. Each step ticks itself off. */
export function SetupGuide() {
  const s = useStore();
  const d = s.data;
  const others = d.people.filter((p) => p.user_id !== d.userId);
  const installed = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const cloud = !s.api.demo && !s.api.local;

  const steps: Step[] = [
    {
      title: "Add the people you assign tasks to",
      done: others.length > 0,
      body: <>Open <b>People</b> and press <b>Add person</b>. A name is all you need; add an email address if you want to email them their tasks. They don't need an account.</>,
      action: { label: "Go to People", go: { kind: "people" } },
    },
    {
      title: "Choose who gets new tasks by default",
      done: d.workspace.default_assignee_ids.length > 0 || d.projects.some((p) => p.default_assignee_ids !== null),
      optional: true,
      body: <>On <b>People</b>, use <b>Assigned to by default</b> for every project. To give one project its own list, edit the project (pencil on its banner), untick <b>Use the workspace default</b> and pick people from the dropdown.</>,
      action: { label: "Go to People", go: { kind: "people" } },
    },
    {
      title: "Create a project",
      done: d.projects.length > 0,
      body: <>Press <b>+</b> next to Projects in the sidebar (or <b>New project</b> on the Projects tab). Pick a color, a default priority, and a category if you like.</>,
      action: { label: "Go to Projects", go: { kind: "projects" } },
    },
    {
      title: "Add tasks with due dates",
      done: d.tasks.some((t) => t.due_date),
      body: <>Add a task, open it, and set <b>Due</b> with Today, Tomorrow or <b>Pick date…</b>, then add a time and a reminder if you want. Tasks with a due date are the ones that go to your calendar.</>,
      action: { label: "Go to All tasks", go: { kind: "all" } },
    },
    {
      title: "Connect Google Calendar or Outlook",
      done: d.calendarFeeds.length > 0,
      body: cloud ? (
        <>
          In <b>Settings → Calendars</b>, choose <b>Every task with a due date</b> (or one person's tasks) and press <b>Make calendar address</b>. Then press <b>Add to Google Calendar</b> or <b>Add to Outlook</b> and confirm in the page that opens. On an iPad, Apple Calendar can subscribe too.
          To add just one task, open it and use <b>Add to calendar</b> under When.
        </>
      ) : (
        <>Calendar subscriptions need the signed-in cloud version. You can still add single tasks: open a task and use <b>Add to calendar</b> under When.</>
      ),
      action: { label: "Go to Calendars", go: { kind: "settings" }, anchor: "calendars" },
    },
    {
      title: "Save the filters you use often",
      done: d.savedFilters.length > 0,
      optional: true,
      body: <>On <b>All tasks</b> or a project, set the filters, then press <b>Save these filters</b> and name it. Saved filters appear in the sidebar; with more than three they fold under <b>Filters</b>.</>,
      action: { label: "Go to All tasks", go: { kind: "all" } },
    },
    {
      title: "Let people update their own tasks",
      done: d.shareLinks.length > 0,
      optional: true,
      body: <>On <b>People</b>, tap a person, then <b>Update link</b>. Send them the link: they can mark their tasks done and add notes without an account. Turn it off at any time.</>,
      action: { label: "Go to People", go: { kind: "people" } },
    },
    {
      title: "Put it on your iPad or phone",
      done: installed,
      optional: true,
      body: <>Open the app in Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>. It opens full screen like an app and stays signed in.</>,
    },
  ];

  const required = steps.filter((st) => !st.optional);
  const doneCount = steps.filter((st) => st.done).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Setup guide</h1>
          <p className="date-line">{doneCount} of {steps.length} done{required.every((st) => st.done) ? ". The essentials are set up." : ""}</p>
        </div>
      </header>
      <ol className="setup-steps">
        {steps.map((st, i) => (
          <li key={st.title} className={"setup-step" + (st.done ? " done" : "")}>
            <span className="setup-num" aria-hidden="true">{st.done ? <CheckIcon size={16} strokeWidth={3} /> : i + 1}</span>
            <div className="setup-text">
              <h2>{st.title}{st.optional && <em>Optional</em>}{st.done && <span className="sr-only"> (done)</span>}</h2>
              <p>{st.body}</p>
              {st.action && (
                <button
                  className="btn small"
                  onClick={() => {
                    s.go(st.action!.go);
                    const anchor = st.action!.anchor;
                    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                  }}
                >
                  {st.action.label}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="field-hint setup-foot">Setting up the database and hosting? See SETUP.md in the GitHub repository.</p>
    </div>
  );
}
