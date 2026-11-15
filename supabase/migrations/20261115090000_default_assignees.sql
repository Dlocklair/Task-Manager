-- Workspace-wide default assignees for new tasks, with an optional per-project override.
-- projects.default_assignee_ids = null means the project uses the workspace default.
alter table public.workspaces
  add column if not exists default_assignee_ids uuid[] not null default '{}';

alter table public.projects
  add column if not exists default_assignee_ids uuid[];
