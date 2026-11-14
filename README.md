# Task Manager

A task manager for tracking projects, tasks, subtasks and the people they are assigned to. It works on a computer, tablet and phone, and stores everything in your own Supabase database.

Built with React, TypeScript and Vite. Data lives in Supabase (Postgres with row-level security); changes sync live between devices.

## What it does

- **Home** – what is overdue, due today and due in the next 7 days, plus progress for every project. Search across all tasks.
- **Projects** – each project has its own color. View tasks as a list grouped by status, or as a board you can drag cards across.
- **Tasks** – status (To do, In progress, Done), priority, due date, details, notes, and any number of nested subtasks.
- **People** – add anyone by name and assign them to tasks. They don't need an account.
- **My tasks** – everything assigned to you, by due date.
- **Phone and tablet** – bottom tab bar and full-screen task details on small screens; "Add to Home Screen" installs it like an app.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Open `http://localhost:5173/?demo` to look around with sample data and no account. Nothing is saved in demo mode.

## Supabase

The connection details are in `.env`. The publishable key is designed to be public; row-level security in the database decides what each signed-in person can see.

The database schema is in `supabase/migrations/`. To rebuild the database from scratch, run those files in order in the Supabase SQL editor (or `supabase db push`).

Sign-in uses an emailed link or an email and password. In the Supabase dashboard under Authentication → URL Configuration, the Site URL and Redirect URLs must include every address the app is served from (for example `http://localhost:5173` and your deployed URL).

## Layout of the code

```
src/
  lib/         types, Supabase client, demo data, app state (store.tsx)
  components/  screens and UI pieces
  styles.css   design tokens and all styling
supabase/migrations/   database schema
```
