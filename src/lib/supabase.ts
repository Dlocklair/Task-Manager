import { createClient } from "@supabase/supabase-js";
import type { Api, Data, Note } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const sb = url && key ? createClient(url, key) : null;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const supabaseApi: Api = {
  demo: false,

  async load(): Promise<Data> {
    const client = sb!;
    const { data: auth } = await client.auth.getUser();
    const user = auth.user;
    if (!user) throw new Error("You are signed out. Sign in again to see your tasks.");

    const members = check(
      await client.from("workspace_members").select("workspace_id").eq("user_id", user.id).order("joined_at").limit(1),
    ) as { workspace_id: string }[];
    if (!members.length) throw new Error("No workspace was found for this account.");
    const wsId = members[0].workspace_id;

    const [ws, projects, tasks, people, assignees] = await Promise.all([
      client.from("workspaces").select("id,name").eq("id", wsId).single(),
      client.from("projects").select("id,workspace_id,name,description,color,position,created_at").eq("workspace_id", wsId).neq("status", "archived").order("position"),
      client.from("tasks").select("id,workspace_id,project_id,parent_task_id,title,description,status,priority,due_date,position,completed_at,created_at").eq("workspace_id", wsId).order("position").limit(5000),
      client.from("people").select("id,workspace_id,user_id,full_name,email,color").eq("workspace_id", wsId).eq("is_archived", false).order("created_at"),
      client.from("task_assignees").select("task_id,person_id").limit(10000),
    ]);

    return {
      userId: user.id,
      email: user.email ?? "",
      workspace: check(ws) as Data["workspace"],
      projects: check(projects) as Data["projects"],
      tasks: check(tasks) as Data["tasks"],
      people: check(people) as Data["people"],
      assignees: check(assignees) as Data["assignees"],
    };
  },

  async insert(table, row) {
    check(await sb!.from(table).insert(row));
  },
  async update(table, id, patch) {
    check(await sb!.from(table).update(patch).eq("id", id));
  },
  async remove(table, id) {
    check(await sb!.from(table).delete().eq("id", id));
  },
  async assign(taskId, personId, on) {
    const q = sb!.from("task_assignees");
    check(on ? await q.insert({ task_id: taskId, person_id: personId }) : await q.delete().eq("task_id", taskId).eq("person_id", personId));
  },
  async notes(taskId) {
    return check(
      await sb!.from("task_comments").select("id,task_id,author_id,body,created_at").eq("task_id", taskId).order("created_at"),
    ) as Note[];
  },
  subscribe(onChange) {
    const client = sb!;
    const channel = client.channel("workspace-changes").on("postgres_changes", { event: "*", schema: "public" }, onChange).subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  },
};
