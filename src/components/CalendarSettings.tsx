import { useState } from "react";
import { CalendarPlus, Copy, Power } from "lucide-react";
import { useStore } from "../lib/store";
import { googleSubscribe, outlookSubscribe, webcal } from "../lib/calendar";
import type { CalendarFeed } from "../lib/types";

/**
 * Calendars: make a private calendar address, then add it to Google Calendar or Outlook.
 * Tasks with a due date appear as events and keep up as tasks change.
 */
export function CalendarSettings() {
  const s = useStore();
  const [who, setWho] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const feeds = s.data.calendarFeeds;
  const people = [...s.data.people].sort((a, b) => a.full_name.localeCompare(b.full_name));

  if (!s.api.createCalendarFeed) {
    return (
      <p className="field-hint">
        {s.api.demo ? "Calendar subscriptions work once you sign in. Sample data has none." : "Calendar subscriptions need the cloud version, because Google and Outlook read them from the internet."} You can still add a single task: open it and use Add to calendar under When.
      </p>
    );
  }

  const make = async () => {
    setBusy(true);
    await s.createCalendarFeed(who === "all" ? null : who);
    setBusy(false);
  };
  const taken = new Set(feeds.map((f) => f.person_id ?? "all"));

  return (
    <>
      {feeds.length === 0 && <p className="field-hint">No calendars connected yet. Choose which tasks to show, then make the address.</p>}
      <ul className="cal-feeds">
        {feeds.map((f) => <FeedRow key={f.token} feed={f} />)}
      </ul>
      <div className="form-inline cal-make">
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Which tasks to show in the calendar">
          <option value="all">Every task with a due date</option>
          {people.map((p) => <option key={p.id} value={p.id}>Tasks assigned to {p.user_id === s.data.userId ? "me" : p.full_name}</option>)}
        </select>
        <button className="btn primary" type="button" disabled={busy || taken.has(who)} onClick={() => void make()}>
          <CalendarPlus size={16} />{busy ? "Making…" : taken.has(who) ? "Already made" : "Make calendar address"}
        </button>
      </div>
      <p className="field-hint">
        Google checks for changes every 8 to 24 hours and Outlook every few hours, so an edit can take a while to show. Finished tasks stay on the calendar for 30 days with a ✓. Anyone with the address can see those tasks, so share it only with people you trust.
      </p>
    </>
  );
}

function FeedRow({ feed }: { feed: CalendarFeed }) {
  const s = useStore();
  const url = s.calendarFeedUrl(feed);
  const person = feed.person_id ? s.data.people.find((p) => p.id === feed.person_id) : undefined;
  const label = feed.person_id ? `Tasks assigned to ${person ? (person.user_id === s.data.userId ? "me" : person.full_name) : "someone removed"}` : "Every task with a due date";
  const name = feed.person_id && person ? `Tasks: ${person.full_name}` : "Tasks";
  if (!url) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      s.toast("Calendar address copied.");
    } catch {
      window.prompt("Copy this address", url);
    }
  };
  return (
    <li className="cal-feed">
      <div className="cal-feed-head">
        <strong>{label}</strong>
        <span className="cal-feed-tz">Times in {feed.timezone.replace(/_/g, " ")}</span>
      </div>
      <div className="cal-feed-actions">
        <a className="btn small" href={googleSubscribe(url)} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
        <a className="btn small" href={outlookSubscribe(url, name, false)} target="_blank" rel="noopener noreferrer">Add to Outlook.com</a>
        <a className="btn small" href={outlookSubscribe(url, name, true)} target="_blank" rel="noopener noreferrer">Add to Outlook (work or school)</a>
        <a className="btn small" href={webcal(url)}>Apple Calendar</a>
        <button type="button" className="btn small quiet" onClick={() => void copy()}><Copy size={14} />Copy address</button>
        <button
          type="button"
          className="btn small quiet danger"
          onClick={() => {
            if (window.confirm(`Turn off this calendar address? Calendars subscribed to it stop getting tasks. You can make a new one later.`)) s.removeCalendarFeed(feed.token);
          }}
        >
          <Power size={14} />Turn off
        </button>
      </div>
    </li>
  );
}
