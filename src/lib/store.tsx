import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Api, Data, Person, Priority, Project, Status, Task, View } from "./types";
import { COLORS, isoDay, uid } from "./util";

interface NewTask {
  project_id: string;
  title: string;
  parent_task_id?: string | null;
  status?: Status;
  priority?: Priority;
  due_date?: string | null;
  assignMe?: boolean;
}

export interface Store {
  api: Api;
  data: Data;
  me: Person | undefined;
  view: View;
  go(view: View): void;
  selectedId: string | null;
  openTask(id: string | null): void;
  toast(message: string): void;

  project(id: string): Project | undefined;
  task(id: string): Task | undefined;
  kids(id: string): Task[];
  topLevel(projectId: string): Task[];
  assigned(taskId: string): Person[];
  tasksFor(personId: string): Task[];
  progress(projectId: string): { total: number; done: number; late: number; pct: number };

  addProject(name: string, color: string): string;
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "color" | "description">>): void;
  deleteProject(id: string): void;
  addTask(input: NewTask): string;
  updateTask(id: string, patch: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "due_date" | "project_id">>): void;
  deleteTask(id: string): void;
  toggleAssignee(taskId: string, personId: string): void;
  addPerson(name: string, email: string | null): void;
  updatePerson(id: string, patch: Partial<Pick<Person, "full_name" | "email" | "color">>): void;
  deletePerson(id: string): void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store is not ready");
  return s;
}

function descendants(tasks: Task[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tasks) {
      if (t.parent_task_id && out.has(t.parent_task_id) && !out.has(t.id)) {
        out.add(t.id);
        grew = true;
      }
    }
  }
  return out;
}

export function StoreProvider({ api, children }: { api: Api; children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "home" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>();

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 5000);
  }, []);

  const reload = useCallback(async () => {
    try {
      setData(await api.load());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your tasks.");
    }
  }, [api]);

  useEffect(() => {
    void reload();
    let timer: number | undefined;
    const stop = api.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void reload(), 700);
    });
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [api, reload]);

  const store = useMemo<Store | null>(() => {
    if (!data) return null;

    const mut = (fn: (d: Data) => Data) => setData((d) => (d ? fn(d) : d));
    // Changes show at once; if saving fails we say so and reload what the database has.
    const save = (p: Promise<void>) => {
      p.catch((e: unknown) => {
        toast(`That change was not saved. ${e instanceof Error ? e.message : ""}`.trim());
        void reload();
      });
    };

    const byParent = new Map<string, Task[]>();
    const top = new Map<string, Task[]>();
    for (const t of data.tasks) {
      const key = t.parent_task_id;
      const map = key ? byParent : top;
      const k = key ?? t.project_id;
      const list = map.get(k);
      if (list) list.push(t);
      else map.set(k, [t]);
    }
    const people = new Map(data.people.map((p) => [p.id, p]));
    const tasks = new Map(data.tasks.map((t) => [t.id, t]));
    const me = data.people.find((p) => p.user_id === data.userId);
    const nextPos = () => Date.now();

    return {
      api,
      data,
      me,
      view,
      go: (v) => {
        setView(v);
        setSelectedId(null);
      },
      selectedId,
      openTask: setSelectedId,
      toast,

      project: (id) => data.projects.find((p) => p.id === id),
      task: (id) => tasks.get(id),
      kids: (id) => byParent.get(id) ?? [],
      topLevel: (projectId) => top.get(projectId) ?? [],
      assigned: (taskId) =>
        data.assignees.filter((a) => a.task_id === taskId).map((a) => people.get(a.person_id)).filter((p): p is Person => !!p),
      tasksFor: (personId) => {
        const ids = new Set(data.assignees.filter((a) => a.person_id === personId).map((a) => a.task_id));
        return data.tasks.filter((t) => ids.has(t.id));
      },
      progress: (projectId) => {
        const list = data.tasks.filter((t) => t.project_id === projectId);
        const today = isoDay();
        const done = list.filter((t) => t.status === "done").length;
        const late = list.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length;
        return { total: list.length, done, late, pct: list.length ? Math.round((100 * done) / list.length) : 0 };
      },

      addProject: (name, color) => {
        const row = { id: uid(), workspace_id: data.workspace.id, name, color, position: nextPos() };
        mut((d) => ({ ...d, projects: [...d.projects, { ...row, description: null, created_at: new Date().toISOString() }] }));
        save(api.insert("projects", row));
        return row.id;
      },
      updateProject: (id, patch) => {
        mut((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
        save(api.update("projects", id, patch));
      },
      deleteProject: (id) => {
        mut((d) => ({ ...d, projects: d.projects.filter((p) => p.id !== id), tasks: d.tasks.filter((t) => t.project_id !== id) }));
        save(api.remove("projects", id));
      },

      addTask: (input) => {
        const row = {
          id: uid(),
          project_id: input.project_id,
          parent_task_id: input.parent_task_id ?? null,
          title: input.title,
          status: input.status ?? ("todo" as Status),
          priority: input.priority ?? ("none" as Priority),
          due_date: input.due_date ?? null,
          position: nextPos(),
        };
        const now = new Date().toISOString();
        const local: Task = { ...row, workspace_id: data.workspace.id, description: null, completed_at: row.status === "done" ? now : null, created_at: now };
        const assign = input.assignMe && me ? me.id : null;
        mut((d) => ({
          ...d,
          tasks: [...d.tasks, local],
          assignees: assign ? [...d.assignees, { task_id: row.id, person_id: assign }] : d.assignees,
        }));
        save(api.insert("tasks", row).then(() => (assign ? api.assign(row.id, assign, true) : undefined)));
        return row.id;
      },
      updateTask: (id, patch) => {
        mut((d) => {
          const moving = patch.project_id ? descendants(d.tasks, id) : null;
          return {
            ...d,
            tasks: d.tasks.map((t) => {
              if (t.id === id) {
                const next = { ...t, ...patch };
                if (patch.status) next.completed_at = patch.status === "done" ? (t.completed_at ?? new Date().toISOString()) : null;
                // A subtask moved to another project becomes a task of its own there.
                if (patch.project_id && patch.project_id !== t.project_id) next.parent_task_id = null;
                return next;
              }
              return moving?.has(t.id) ? { ...t, project_id: patch.project_id! } : t;
            }),
          };
        });
        const current = tasks.get(id);
        const remote: Record<string, unknown> = { ...patch };
        if (patch.project_id && current && patch.project_id !== current.project_id && current.parent_task_id) remote.parent_task_id = null;
        save(api.update("tasks", id, remote));
      },
      deleteTask: (id) => {
        mut((d) => {
          const gone = descendants(d.tasks, id);
          return { ...d, tasks: d.tasks.filter((t) => !gone.has(t.id)), assignees: d.assignees.filter((a) => !gone.has(a.task_id)) };
        });
        if (selectedId === id) setSelectedId(null);
        save(api.remove("tasks", id));
      },
      toggleAssignee: (taskId, personId) => {
        const on = !data.assignees.some((a) => a.task_id === taskId && a.person_id === personId);
        mut((d) => ({
          ...d,
          assignees: on
            ? [...d.assignees, { task_id: taskId, person_id: personId }]
            : d.assignees.filter((a) => !(a.task_id === taskId && a.person_id === personId)),
        }));
        save(api.assign(taskId, personId, on));
      },

      addPerson: (name, email) => {
        const row = { id: uid(), workspace_id: data.workspace.id, full_name: name, email, color: COLORS[data.people.length % COLORS.length] };
        mut((d) => ({ ...d, people: [...d.people, { ...row, user_id: null }] }));
        save(api.insert("people", row));
      },
      updatePerson: (id, patch) => {
        mut((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
        save(api.update("people", id, patch));
      },
      deletePerson: (id) => {
        mut((d) => ({ ...d, people: d.people.filter((p) => p.id !== id), assignees: d.assignees.filter((a) => a.person_id !== id) }));
        save(api.remove("people", id));
      },
    };
  }, [api, data, view, selectedId, toast, reload]);

  if (error && !store) {
    return (
      <div className="center-screen">
        <div className="notice">
          <h2>Your tasks did not load</h2>
          <p>{error}</p>
          <button className="btn primary" onClick={() => void reload()}>Try again</button>
        </div>
      </div>
    );
  }
  if (!store) return <div className="center-screen"><div className="spinner" aria-label="Loading your tasks" /></div>;

  return (
    <Ctx.Provider value={store}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}
