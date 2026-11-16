import { useEffect, useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { demoApi } from "./lib/demo";
import { StoreProvider, useStore } from "./lib/store";
import { sb, supabaseApi } from "./lib/supabase";
import type { Project } from "./lib/types";
import { Auth } from "./components/Auth";
import { ProjectView } from "./components/ProjectView";
import { MobileNav, NewTaskDialog, ProjectDialog, Sidebar } from "./components/Shell";
import { LeaveDialog } from "./components/LeaveDialog";
import { BulkBar } from "./components/BulkBar";
import { Reminders } from "./components/Reminders";
import { TaskDetail } from "./components/TaskDetail";
import { Home, MyTasks, People, Projects } from "./components/views";
import { AllTasks } from "./components/AllTasks";

const demo = !sb || new URLSearchParams(window.location.search).has("demo");

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(demo ? null : undefined);

  useEffect(() => {
    if (demo || !sb) return;
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (demo) return <StoreProvider api={demoApi}><Workspace /></StoreProvider>;
  if (session === undefined) return <div className="center-screen"><div className="spinner" aria-label="Loading" /></div>;
  if (!session) return <Auth />;
  return (
    <StoreProvider api={supabaseApi} key={session.user.id}>
      <Workspace onSignOut={() => void sb!.auth.signOut()} />
    </StoreProvider>
  );
}

function Workspace({ onSignOut }: { onSignOut?: () => void }) {
  const s = useStore();
  const [projectDialog, setProjectDialog] = useState<{ project?: Project } | null>(null);
  const [newTask, setNewTask] = useState(false);
  const selected = s.selectedId ? s.task(s.selectedId) : undefined;
  const project = s.view.kind === "project" ? s.project(s.view.id) : undefined;
  const newProject = () => setProjectDialog({});

  return (
    <div className={"app" + (selected ? " has-detail" : "")}>
      <Sidebar onNewProject={newProject} onSignOut={onSignOut} />
      <main className="main">
        {!selected && (
          <div className="main-top">
            <div className="top-actions">
              <button className={"btn" + (s.selecting ? " primary" : "")} aria-pressed={s.selecting} onClick={() => s.setSelecting(!s.selecting)}>
                <ListChecks size={17} />{s.selecting ? "Done selecting" : "Select multiple"}
              </button>
              <button className="new-task" onClick={() => setNewTask(true)}><Plus size={18} />New task</button>
            </div>
          </div>
        )}
        {s.view.kind === "home" && <Home onNewProject={newProject} />}
        {s.view.kind === "projects" && <Projects onNewProject={newProject} />}
        {s.view.kind === "all" && <AllTasks />}
        {s.view.kind === "my" && <MyTasks />}
        {s.view.kind === "people" && <People />}
        {s.view.kind === "project" && (project ? <ProjectView key={project.id} project={project} onEdit={() => setProjectDialog({ project })} /> : <Home onNewProject={newProject} />)}
      </main>
      {selected && (
        <>
          <div className="detail-scrim" onClick={() => s.openTask(null)} />
          <TaskDetail task={selected} />
        </>
      )}
      <MobileNav onNewTask={() => setNewTask(true)} />
      {projectDialog && <ProjectDialog project={projectDialog.project} onClose={() => setProjectDialog(null)} />}
      {newTask && <NewTaskDialog onClose={() => setNewTask(false)} />}
      <BulkBar />
      <Reminders />
      <LeaveDialog />
    </div>
  );
}
