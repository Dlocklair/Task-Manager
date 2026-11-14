-- Each project can set the priority that new tasks in it start with. New projects default to medium.
alter table public.projects
  add column if not exists default_priority public.task_priority not null default 'medium';
