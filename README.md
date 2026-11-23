# Task Manager

A task manager for tracking projects, tasks, subtasks and the people they are assigned to. It works on a computer, tablet and phone, and stores everything in your own Supabase database.

Built with React, TypeScript and Vite. Data lives in Supabase (Postgres with row-level security); changes sync live between devices.

## What it does

- **Home** – what is overdue, due today and due in the next 7 days, plus progress for every project. Search across all tasks.
- **Projects** – each project has its own color. View tasks as a list grouped by status, or as a board you can drag cards across.
- **Tasks** – status (To do, In progress, Done), priority, due date, details, notes, and any number of nested subtasks.
- **People** – add anyone by name and assign them to tasks. They don't need an account.
- **Update links** – give someone a private link (People → Update link, or from Email tasks). It opens their assigned tasks with no sign-in; they can change status and add notes, and the changes appear in your tasks. Turn a link off at any time.
- **Email tasks** – sends an easy-to-read outline (numbered tasks with due date, priority, details and subtasks), with a Word document of the same list to attach or share.
- **Calendars** – Settings → Calendars makes a private calendar address that Google Calendar, Outlook or Apple Calendar subscribes to; tasks with due dates show up as events. Any single task can also be added from its Calendar line.
- **Saved filters** – appear in the sidebar; more than three fold under a Filters heading.
- **Setup guide** – the compass button in the sidebar walks through people, defaults, projects, calendars and more. The same steps are in [SETUP.md](SETUP.md).
- **Settings** – calendars, and rename, add, remove and reorder contexts.
- **My tasks** – everything assigned to you, by due date.
- **Phone and tablet** – bottom tab bar and full-screen task details on small screens; "Add to Home Screen" installs it like an app.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Open `http://localhost:5173/?demo` to look around with sample data and no account. Nothing is saved in demo mode. `?update=demo` shows the page an update link opens.

## Supabase

The connection details are in `.env`. The publishable key is designed to be public; row-level security in the database decides what each signed-in person can see.

The database schema is in `supabase/migrations/`; the calendar feed is the Edge Function in `supabase/functions/calendar-feed` (deploy with JWT verification off). See [SETUP.md](SETUP.md). To rebuild the database from scratch, run those files in order in the Supabase SQL editor (or `supabase db push`).

Sign-in uses an emailed link or an email and password. In the Supabase dashboard under Authentication → URL Configuration, the Site URL and Redirect URLs must include every address the app is served from (for example `http://localhost:5173` and your deployed URL).

## Layout of the code

```
src/
  lib/         types, Supabase client, demo data, app state (store.tsx)
  components/  screens and UI pieces
  styles.css   design tokens and all styling
supabase/migrations/   database schema
```
