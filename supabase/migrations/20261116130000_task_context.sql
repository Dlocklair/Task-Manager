-- Context says where or how a task can be done: at a computer, on the phone, at home, running errands, or in the car.
-- Null means no context. Existing tasks keep null until they are given one.
alter table public.tasks
  add column context text
  check (context in ('computer', 'phone', 'home', 'errands', 'car'));

create index tasks_context_idx on public.tasks (workspace_id, context);
