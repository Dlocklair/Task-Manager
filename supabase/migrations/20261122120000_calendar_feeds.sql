-- Calendar feeds put tasks with a due date into Google Calendar, Outlook or Apple Calendar.
-- Each feed is a private web address (an iCalendar subscription). The calendar app checks it every few hours.
-- A feed shows every task with a due date, or only those assigned to one person.
-- Deleting the feed turns the address off at once.
create table public.calendar_feeds (
  token text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- null = every task with a due date
  person_id uuid references public.people (id) on delete cascade,
  -- Due times are wall-clock times in this time zone.
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  created_at timestamptz not null default now()
);

create index calendar_feeds_workspace_idx on public.calendar_feeds (workspace_id);
create index calendar_feeds_person_idx on public.calendar_feeds (person_id);

alter table public.calendar_feeds enable row level security;
revoke all on public.calendar_feeds from anon;
grant select, insert, delete on public.calendar_feeds to authenticated;

create policy "calendar_feeds_select" on public.calendar_feeds for select to authenticated
  using (private.can_edit_workspace(workspace_id));
create policy "calendar_feeds_insert" on public.calendar_feeds for insert to authenticated
  with check (
    private.can_edit_workspace(workspace_id)
    and (person_id is null or exists (select 1 from public.people p where p.id = person_id and p.workspace_id = calendar_feeds.workspace_id))
  );
create policy "calendar_feeds_delete" on public.calendar_feeds for delete to authenticated
  using (private.can_edit_workspace(workspace_id));

-- What a feed shows: open tasks with a due date, and ones finished in the last 30 days.
-- Called by the calendar-feed Edge Function with the feed's token; returns null for an unknown token.
create or replace function public.calendar_feed(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f public.calendar_feeds;
begin
  select * into f from public.calendar_feeds where token = p_token;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'workspace', (select name from public.workspaces where id = f.workspace_id),
    'person', (select full_name from public.people where id = f.person_id),
    'timezone', f.timezone,
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id, 'title', t.title, 'description', t.description, 'status', t.status,
          'priority', t.priority, 'due_date', t.due_date, 'due_time', t.due_time,
          'remind_before_minutes', t.remind_before_minutes,
          'project', p.name, 'parent_title', pt.title,
          'people', coalesce((
            select jsonb_agg(pe.full_name order by pe.full_name)
            from public.task_assignees a2 join public.people pe on pe.id = a2.person_id
            where a2.task_id = t.id
          ), '[]'::jsonb)
        ) order by t.due_date, t.due_time nulls first)
      from public.tasks t
      left join public.projects p on p.id = t.project_id
      left join public.tasks pt on pt.id = t.parent_task_id
      where t.workspace_id = f.workspace_id
        and t.due_date is not null
        and (t.status <> 'done' or t.completed_at > now() - interval '30 days')
        and (f.person_id is null or exists (select 1 from public.task_assignees a where a.task_id = t.id and a.person_id = f.person_id))
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
