-- 1. Contexts can be edited. The list lives on the workspace; a task stores the id of one entry.
--    The five original contexts become the starting list, with their old ids, so existing tasks keep theirs.
alter table public.tasks drop constraint if exists tasks_context_check;
alter table public.tasks
  add constraint tasks_context_check check (context is null or char_length(context) between 1 and 60);

alter table public.workspaces
  add column contexts jsonb not null default
    '[{"id":"computer","label":"Computer"},{"id":"phone","label":"Phone"},{"id":"home","label":"Home"},{"id":"errands","label":"Errands"},{"id":"car","label":"Car"}]'::jsonb
  check (jsonb_typeof(contexts) = 'array' and jsonb_array_length(contexts) <= 50);

-- 2. A task may have no project. Then workspace_id comes from the app on insert and never changes after.
alter table public.tasks alter column project_id drop not null;

create or replace function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_project uuid;
  parent_ws uuid;
  cursor_id uuid;
  depth int := 0;
begin
  if new.project_id is not null then
    select p.workspace_id into new.workspace_id
    from public.projects p where p.id = new.project_id;
  elsif tg_op = 'UPDATE' then
    new.workspace_id := old.workspace_id;
  end if;

  if new.parent_task_id is not null then
    select t.project_id, t.workspace_id into parent_project, parent_ws
    from public.tasks t where t.id = new.parent_task_id;

    if not found then
      raise exception 'Parent task % not found', new.parent_task_id;
    end if;
    if parent_ws <> new.workspace_id then
      raise exception 'A subtask must be in the same workspace as its parent';
    end if;
    if parent_project is distinct from new.project_id then
      raise exception 'A subtask must be in the same project as its parent';
    end if;

    -- Walk up the tree to make sure we are not our own ancestor.
    cursor_id := new.parent_task_id;
    while cursor_id is not null loop
      if cursor_id = new.id then
        raise exception 'A task cannot be nested under its own subtask';
      end if;
      depth := depth + 1;
      if depth > 10 then
        raise exception 'Subtasks can be nested at most 10 levels deep';
      end if;
      select t.parent_task_id into cursor_id from public.tasks t where t.id = cursor_id;
    end loop;
  end if;

  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

-- Insert and update checks use the project's workspace, or the task's own when it has no project.
drop policy "tasks_insert" on public.tasks;
drop policy "tasks_update" on public.tasks;

create policy "tasks_insert" on public.tasks for insert to authenticated
  with check (private.can_edit_workspace(coalesce((select p.workspace_id from public.projects p where p.id = project_id), workspace_id)));
create policy "tasks_update" on public.tasks for update to authenticated
  using (private.can_edit_workspace(workspace_id))
  with check (private.can_edit_workspace(coalesce((select p.workspace_id from public.projects p where p.id = project_id), workspace_id)));
