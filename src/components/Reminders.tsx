import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useStore } from "../lib/store";
import { dueLabel, formatTime, dueMoment, reminderMoment } from "../lib/util";

// Reminders fire while the app is open in a browser or home-screen app. Which ones have fired is remembered on this device.
const FIRED_KEY = "tm-reminders-fired";
const WINDOW_MS = 12 * 3600e3;

interface Alert {
  key: string;
  taskId: string;
  title: string;
  body: string;
}

function loadFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function saveFired(fired: Record<string, number>) {
  const cutoff = Date.now() - 30 * 86400e3;
  const kept = Object.fromEntries(Object.entries(fired).filter(([, at]) => at > cutoff));
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(kept));
  } catch {
    // Storage can be full or blocked; the reminder may repeat, which is safer than missing it.
  }
}

export function Reminders() {
  const s = useStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [canNotify] = useState(() => typeof Notification !== "undefined");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [hidePrompt, setHidePrompt] = useState(false);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const fired = loadFired();
      const fresh: Alert[] = [];
      for (const t of s.data.tasks) {
        if (t.status === "done") continue;
        const at = reminderMoment(t);
        if (!at || !t.due_date) continue;
        // Skip reminders that are in the future, long past, or for tasks already overdue beyond their due moment.
        const now0 = now - at.getTime();
        if (now0 < 0 || now0 > WINDOW_MS || now > dueMoment(t.due_date, t.due_time).getTime()) continue;
        const key = `${t.id}|${at.getTime()}`;
        if (fired[key]) continue;
        fired[key] = now;
        const when = `${dueLabel(t.due_date)}${t.due_time ? ` at ${formatTime(t.due_time)}` : ""}`;
        fresh.push({ key, taskId: t.id, title: t.title, body: `Due ${when}` });
      }
      if (fresh.length === 0) return;
      saveFired(fired);
      setAlerts((a) => [...fresh, ...a].slice(0, 6));
      if (canNotify && Notification.permission === "granted") {
        for (const f of fresh) {
          try {
            new Notification(`Reminder: ${f.title}`, { body: f.body, tag: f.key });
          } catch {
            // Some mobile browsers only show notifications from an installed app; the in-app card still appears.
          }
        }
      }
    };
    check();
    const timer = window.setInterval(check, 30000);
    return () => window.clearInterval(timer);
  }, [s.data.tasks, canNotify]);

  const askPermission = async () => {
    if (!canNotify) return;
    setPermission(await Notification.requestPermission());
  };

  const showPrompt = canNotify && permission === "default" && !hidePrompt;

  if (alerts.length === 0 && !showPrompt) return null;
  return (
    <div className="reminder-stack" aria-live="polite">
      {alerts.map((a) => (
        <div key={a.key} className="reminder-card" role="alert">
          <div className="reminder-title"><BellRing size={16} /> <strong>{a.title}</strong></div>
          <p>{a.body}</p>
          <footer>
            <button className="btn small" onClick={() => { s.openTask(a.taskId); setAlerts((list) => list.filter((x) => x.key !== a.key)); }}>Open task</button>
            <button className="btn small" onClick={() => setAlerts((list) => list.filter((x) => x.key !== a.key))} aria-label="Dismiss reminder"><X size={14} /></button>
          </footer>
        </div>
      ))}
      {showPrompt && (
        <div className="reminder-card">
          <p>Show reminders as notifications on this device, even when the app is in the background?</p>
          <footer>
            <button className="btn small" onClick={() => setHidePrompt(true)}>Not now</button>
            <button className="btn small primary" onClick={() => void askPermission()}>Turn on</button>
          </footer>
        </div>
      )}
    </div>
  );
}
