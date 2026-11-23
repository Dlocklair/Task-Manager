import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { demoApi } from "./lib/demo";
import { StoreProvider, useStore } from "./lib/store";
import { sb, supabaseApi } from "./lib/supabase";
import { deviceApi } from "./lib/device";
import type { Project } from "./lib/types";
import { Auth } from "./components/Auth";
import { ProjectView } from "./components/ProjectView";
import { MobileNav, NewTaskDialog, ProjectDialog, Sidebar } from "./components/Shell";
import { LeaveDialog } from "./components/LeaveDialog";
import { BulkBar } from "./components/BulkBar";
import { Reminders } from "./components/Reminders";
import { applySavedTweaks, TweaksPanel, tweaksEnabled } from "./components/Tweaks";
import { TaskDetail } from "./components/TaskDetail";
import { Home, MyTasks, People, Projects } from "./components/views";
import { AllTasks } from "./components/AllTasks";
import { SettingsPage } from "./components/Settings";
import { SetupGuide } from "./components/SetupGuide";
import { SharedTasks } from "./components/SharedTasks";
import { NewTaskContext } from "./components/TopActions";

applySavedTweaks();

const params = new URLSearchParams(window.location.search);
const demo = !sb || params.has("demo");
/** An update link: someone you assigned tasks to, opening their tasks with no account. */
const updateToken = params.get("update");
const DEVICE_KEY = "task-manager-device-mode";
// Device-only mode is off unless VITE_DEVICE_MODE=1 is set at build time. Beta testers use the cloud version.
const deviceEnabled = import.meta.env.VITE_DEVICE_MODE === "1";

export default function App() {
  if (updateToken) return <SharedTasks token={updateToken} />;
  return <MainApp />;
}

function MainApp() {
  const [session, setSession] = useState<Session | null | undefined>(demo ? null : undefined);
  const [device, setDevice] = useState(() => deviceEnabled && localStorage.getItem(DEVICE_KEY) === "1");

  useEffect(() => {
    if (demo || !sb) return;
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (demo) return <StoreProvider api={demoApi}><Workspace /></StoreProvider>;
  if (device) {
    return (
      <StoreProvider api={deviceApi} key="device">
        <Workspace onSignOut={() => { localStorage.removeItem(DEVICE_KEY); setDevice(false); }} />
      </StoreProvider>
    );
  }
  if (session === undefined) return <div className="center-screen"><div className="spinner" aria-label="Loading" /></div>;
  if (!session) {
    return <Auth onUseDevice={deviceEnabled ? () => { localStorage.setItem(DEVICE_KEY, "1"); setDevice(true); } : undefined} />;
  }
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
        <NewTaskContext.Provider value={() => setNewTask(true)}>
        {s.view.kind === "home" && <Home onNewProject={newProject} />}
        {s.view.kind === "projects" && <Projects onNewProject={newProject} />}
        {s.view.kind === "all" && <AllTasks key={s.view.filterId ?? "all"} filterId={s.view.filterId} />}
        {s.view.kind === "my" && <MyTasks />}
        {s.view.kind === "people" && <People />}
        {s.view.kind === "settings" && <SettingsPage onSignOut={onSignOut} />}
        {s.view.kind === "setup" && <SetupGuide />}
        {s.view.kind === "project" && (project ? <ProjectView key={project.id + (s.view.filterId ?? "")} project={project} filterId={s.view.filterId} onEdit={() => setProjectDialog({ project })} /> : <Home onNewProject={newProject} />)}
        </NewTaskContext.Provider>
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
      {tweaksEnabled() && <TweaksPanel />}
      <LeaveDialog />
    </div>
  );
}
