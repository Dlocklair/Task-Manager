-- Update links let someone you assign tasks to see and update those tasks without an account.
-- Each person has at most one link. Anyone holding the link can see that person's assigned tasks,
-- change their status and add a note. Deleting the link turns it off at once.
create table public.share_links (
  token text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  person_id uuid not null unique references public.people (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index share_links_workspace_idx on public.share_links (workspace_id);

alter table public.share_links enable row level security;
revoke all on public.share_links from anon;
grant select, insert, delete on public.share_links to authenticated;

create policy "share_links_select" on public.share_links for select to authenticated
  using (private.can_edit_workspace(workspace_id));
create policy "share_links_insert" on public.share_links for insert to authenticated
  with check (
    private.can_edit_workspace(workspace_id)
    and exists (select 1 from public.people p where p.id = person_id and p.workspace_id = share_links.workspace_id)
  );
create policy "share_links_delete" on public.share_links for delete to authenticated
  using (private.can_edit_workspace(workspace_id));

-- Notes added through a link have no account behind them, so they carry the person's name instead.
alter table public.task_comments alter column author_id drop not null;
alter table public.task_comments
  add column author_name text check (author_name is null or char_length(author_name) between 1 and 200);

-- What the link shows: the person's open tasks, and ones finished in the last 14 days.
create or replace function public.shared_tasks(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.share_links;
begin
  select * into l from public.share_links where token = p_token;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'person', (select full_name from public.people where id = l.person_id),
    'workspace', (select name from public.workspaces where id = l.workspace_id),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id, 'title', t.title, 'description', t.description, 'status', t.status,
          'priority', t.priority, 'due_date', t.due_date, 'due_time', t.due_time,
          'project', p.name, 'project_color', p.color, 'parent_title', pt.title,
          'notes', coalesce((
            select jsonb_agg(jsonb_build_object('body', c.body, 'created_at', c.created_at) order by c.created_at)
            from public.task_comments c where c.task_id = t.id and c.author_name is not null
          ), '[]'::jsonb)
        ) order by t.due_date nulls last, t.position)
      from public.task_assignees a
      join public.tasks t on t.id = a.task_id
      left join public.projects p on p.id = t.project_id
      left join public.tasks pt on pt.id = t.parent_task_id
      where a.person_id = l.person_id
        and t.workspace_id = l.workspace_id
        and (t.status <> 'done' or t.completed_at > now() - interval '14 days')
    ), '[]'::jsonb)
  );
end;
$$;

-- Change the status of one of the person's tasks and/or add a note to it.
create or replace function public.shared_update(p_token text, p_task_id uuid, p_status text default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.share_links;
  who text;
begin
  select * into l from public.share_links where token = p_token;
  if not found then
    raise exception 'This link has been turned off';
  end if;
  if not exists (
    select 1 from public.task_assignees a join public.tasks t on t.id = a.task_id
    where a.task_id = p_task_id and a.person_id = l.person_id and t.workspace_id = l.workspace_id
  ) then
    raise exception 'This task is no longer assigned to you';
  end if;

  if p_status is not null then
    if p_status not in ('todo', 'in_progress', 'done') then
      raise exception 'Unknown status';
    end if;
    update public.tasks set status = p_status::public.task_status where id = p_task_id;
  end if;

  if p_note is not null and char_length(btrim(p_note)) > 0 then
    if char_length(p_note) > 4000 then
      raise exception 'Notes can be at most 4000 characters';
    end if;
    select full_name into who from public.people where id = l.person_id;
    insert into public.task_comments (task_id, author_id, author_name, body)
    values (p_task_id, null, coalesce(nullif(btrim(who), ''), 'Assignee'), btrim(p_note));
  end if;
end;
$$;

revoke execute on function public.shared_tasks(text) from public;
revoke execute on function public.shared_update(text, uuid, text, text) from public;
grant execute on function public.shared_tasks(text) to anon, authenticated;
grant execute on function public.shared_update(text, uuid, text, text) to anon, authenticated;
