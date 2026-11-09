# Task Manager

A color-coded task manager for organizing work by project. Tasks can have any number of subtasks and notes, and new tasks are added to whichever project is selected.

Built with React + TypeScript + Vite. Visual style follows the Gift Navigator design system (dark surfaces, teal for actions, lucide icons).

## Features

- **Projects** — create, rename, recolor and delete projects from the sidebar. Selecting a project filters the board to it.
- **Default project** — while a project is selected, every task you add (Add Task button or the quick-add box in any column) goes into that project. With *All projects* open, quick-add uses the last project you added to.
- **Tasks** — title, description, status, priority, due date and owner, all editable in the details panel.
- **Subtasks** — add as many as you need (type and press Enter repeatedly), check them off, rename in place, reorder with the arrows, delete. Progress shows on the card.
- **Notes** — add time-stamped notes to any task (Ctrl/⌘ + Enter to add), edit or delete them.
- **Board and List views** — drag cards between status columns, or use the status buttons in the details panel.
- **Filters** — summary tiles (Overdue, Due today, In progress, Completed), priority chips and search across titles, subtasks and notes.
- **Saved automatically** in the browser (localStorage). Export/Import a JSON backup from the sidebar.

## Color key

| Meaning | Shape | Colors |
| --- | --- | --- |
| Status | round dot | To do = violet · In progress = blue · In review = pink · Done = green |
| Priority | signal bars (1–4) | Urgent = red · High = orange · Medium / Low = neutral |
| Due date | badge | late = red · due today = amber · done = green |
| Project | small square | the color you pick for the project |

Every color is paired with a text label, so nothing relies on color alone.

## Run it

```bash
npm install
npm run dev          # local dev server
npm run build        # production build in dist/
npm run build:single # one self-contained file in dist-single/index.html
```

## Code map

- `src/types.ts` — data model (Project, Task, Subtask, Note)
- `src/store.ts` — reducer with every action + localStorage persistence
- `src/constants.ts` — status, priority and project colors
- `src/App.tsx` — layout, filters, dialogs
- `src/components/` — Sidebar, Board, TaskCard, ListView, TaskDetail (subtasks + notes), dialogs
