import type { Api, Data, Note, Person, Project, Task } from "./types";
import { addDays, COLORS } from "./util";

// Sample data for looking around without an account. Nothing is saved.
const WS = "demo-workspace";

function build(): Data {
  const now = new Date().toISOString();
  const people: Person[] = [
    { id: "p-me", workspace_id: WS, user_id: "demo-user", full_name: "David Locklair", email: null, color: COLORS[0] },
    { id: "p-maria", workspace_id: WS, user_id: null, full_name: "Maria Chen", email: null, color: COLORS[5] },
    { id: "p-joe", workspace_id: WS, user_id: null, full_name: "Joe Alvarez", email: null, color: COLORS[1] },
    { id: "p-sam", workspace_id: WS, user_id: null, full_name: "Sam Okafor", email: null, color: COLORS[3] },
  ];
  const projects: Project[] = [
    { id: "pr-kitchen", name: "Kitchen remodel", color: COLORS[4] },
    { id: "pr-lake", name: "Lake house turnover", color: COLORS[1] },
    { id: "pr-app", name: "Gift app launch", color: COLORS[6] },
    { id: "pr-taxes", name: "Taxes and paperwork", color: COLORS[3] },
  ].map((p, i) => ({ ...p, workspace_id: WS, description: null, position: i, created_at: now }));

  const tasks: Task[] = [];
  const assignees: Data["assignees"] = [];
  let n = 0;
  const add = (
    project: string, title: string, status: Task["status"], due: number | null, priority: Task["priority"],
    who: string[] = [], parent: string | null = null, description: string | null = null,
  ): string => {
    const id = `t-${++n}`;
    tasks.push({
      id, workspace_id: WS, project_id: project, parent_task_id: parent, title, description, status, priority,
      due_date: due === null ? null : addDays(due), position: n, completed_at: status === "done" ? now : null, created_at: now,
    });
    who.forEach((p) => assignees.push({ task_id: id, person_id: p }));
    return id;
  };

  const cab = add("pr-kitchen", "Order cabinets", "in_progress", -1, "high", ["p-me"], null, "Shaker style, soft-close hinges. Quote from the showroom is good until the end of the month.");
  add("pr-kitchen", "Measure the north wall again", "done", null, "none", ["p-me"], cab);
  add("pr-kitchen", "Pick the door finish", "done", null, "none", ["p-maria"], cab);
  add("pr-kitchen", "Send the deposit", "todo", 0, "none", ["p-me"], cab);
  add("pr-kitchen", "Confirm delivery window", "todo", 4, "none", [], cab);
  add("pr-kitchen", "Get two quotes for the countertop", "todo", 0, "medium", ["p-me", "p-maria"]);
  add("pr-kitchen", "Rough-in plumbing inspection", "todo", 3, "urgent", ["p-joe"]);
  add("pr-kitchen", "Choose backsplash tile", "todo", 9, "low", ["p-maria"]);
  add("pr-kitchen", "Demo the old cabinets", "done", -6, "none", ["p-joe"]);
  add("pr-kitchen", "Pull the electrical permit", "done", -9, "none", ["p-me"]);

  const turn = add("pr-lake", "Deep clean before the next guests", "todo", 1, "high", ["p-sam"]);
  add("pr-lake", "Wash and replace linens", "todo", 1, "none", ["p-sam"], turn);
  add("pr-lake", "Restock coffee and soap", "todo", 1, "none", ["p-sam"], turn);
  add("pr-lake", "Fix the sticking deck door", "in_progress", 2, "medium", ["p-joe"]);
  add("pr-lake", "Update the listing photos", "todo", 12, "low", ["p-me"]);
  add("pr-lake", "Replace the smoke alarm batteries", "done", -3, "none", ["p-sam"]);

  add("pr-app", "Write the store description", "in_progress", 0, "medium", ["p-me"]);
  add("pr-app", "Record a 30-second walkthrough", "todo", 6, "none", ["p-me"]);
  add("pr-app", "Invite ten beta testers", "todo", -2, "high", ["p-me", "p-maria"]);
  add("pr-app", "Set up the feedback form", "done", -4, "none", ["p-maria"]);

  add("pr-taxes", "Gather the 1099s", "todo", 20, "none", ["p-me"]);
  add("pr-taxes", "Send receipts to the accountant", "todo", null, "low", ["p-me"]);

  return { userId: "demo-user", email: "demo@example.com", workspace: { id: WS, name: "Demo workspace" }, projects, tasks, people, assignees };
}

const demoNotes: Record<string, Note[]> = {
  "t-1": [
    { id: "n-1", task_id: "t-1", author_id: "demo-user", body: "Showroom says six weeks lead time once the deposit is in.", created_at: new Date(Date.now() - 3 * 864e5).toISOString() },
  ],
};

export const demoApi: Api = {
  demo: true,
  load: async () => build(),
  insert: async (table, row) => {
    if (table === "task_comments") (demoNotes[row.task_id as string] ??= []).push({ author_id: "demo-user", created_at: new Date().toISOString(), ...row } as Note);
  },
  update: async () => {},
  remove: async (table, id) => {
    if (table === "task_comments") for (const k of Object.keys(demoNotes)) demoNotes[k] = demoNotes[k].filter((n) => n.id !== id);
  },
  assign: async () => {},
  notes: async (taskId) => [...(demoNotes[taskId] ?? [])],
  subscribe: () => () => {},
};
