-- =====================================================================
-- Task Manager — initial schema
-- Workspaces → Projects → Tasks → Subtasks, with People assignment,
-- labels, comments, activity history, and row-level security.
--
-- Run in the Supabase SQL editor, or save under supabase/migrations/
-- and run `supabase db push`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Types
-- ---------------------------------------------------------------------
create type public.workspace_role  as enum ('owner', 'admin', 'member', 'viewer');
create type public.project_status  as enum ('planning', 'active', 'on_hold', 'completed', 'archived');
create type public.task_status     as enum ('todo', 'in_progress', 'blocked', 'review', 'done');
create type public.task_priority   as enum ('none', 'low', 'medium', 'high', 'urgent');

-- Functions that bypass RLS live here; this schema is not exposed by the API.
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- 1. Shared helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Rows never move between workspaces (that would orphan assignments
-- and labels). Attached to projects, people and labels below.
create or replace function public.prevent_workspace_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception '% rows cannot be moved to another workspace', tg_table_name;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Profiles (one per signed-in user)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Workspaces and membership (the sharing boundary)
-- ---------------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  owner_id    uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.workspace_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- Role checks. SECURITY DEFINER so policies on workspace_members
-- can call them without recursing into their own RLS.
create or replace function private.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function private.can_admin_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------
-- 4. People — anyone tasks can be assigned to.
--    They do NOT need an account; user_id links them once they sign up.
-- ---------------------------------------------------------------------
create table public.people (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  full_name    text not null check (char_length(full_name) between 1 and 120),
  email        text,
  title        text,
  color        text not null default '#6366F1',
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create unique index people_workspace_email_uidx
  on public.people (workspace_id, lower(email)) where email is not null;
create index people_user_idx on public.people (user_id);

create trigger people_updated_at before update on public.people
  for each row execute function public.set_updated_at();

create trigger people_lock_workspace before update of workspace_id on public.people
  for each row execute function public.prevent_workspace_change();

-- ---------------------------------------------------------------------
-- 5. Projects
-- ---------------------------------------------------------------------
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 160),
  description  text,
  status       public.project_status not null default 'active',
  color        text not null default '#6366F1',
  icon         text,
  lead_id      uuid references public.people (id) on delete set null,
  start_date   date,
  due_date     date,
  position     double precision not null default 0,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create index projects_workspace_idx on public.projects (workspace_id, position);
create index projects_lead_idx on public.projects (lead_id);
create index projects_created_by_idx on public.projects (created_by);

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create trigger projects_lock_workspace before update of workspace_id on public.projects
  for each row execute function public.prevent_workspace_change();

-- ---------------------------------------------------------------------
-- 6. Tasks and subtasks (parent_task_id = null → top-level task)
-- ---------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  parent_task_id  uuid references public.tasks (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 300),
  description     text,
  status          public.task_status not null default 'todo',
  priority        public.task_priority not null default 'none',
  start_date      date,
  due_date        date,
  estimate_hours  numeric(6,2) check (estimate_hours is null or estimate_hours >= 0),
  position        double precision not null default 0,
  completed_at    timestamptz,
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (parent_task_id is null or parent_task_id <> id),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create index tasks_project_idx   on public.tasks (project_id, status, position);
create index tasks_parent_idx    on public.tasks (parent_task_id);
create index tasks_workspace_idx on public.tasks (workspace_id);
create index tasks_due_idx       on public.tasks (workspace_id, due_date) where status <> 'done';
create index tasks_created_by_idx on public.tasks (created_by);

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- Keep workspace_id in sync with the project, keep subtasks in their
-- parent's project, block cycles, and stamp completed_at.
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_project uuid;
  cursor_id uuid;
  depth int := 0;
begin
  select p.workspace_id into new.workspace_id
  from public.projects p where p.id = new.project_id;

  if new.parent_task_id is not null then
    select t.project_id into parent_project
    from public.tasks t where t.id = new.parent_task_id;

    if parent_project is null then
      raise exception 'Parent task % not found', new.parent_task_id;
    end if;
    if parent_project <> new.project_id then
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

create trigger tasks_before_write
  before insert or update of workspace_id, project_id, parent_task_id, status on public.tasks
  for each row execute function public.tasks_before_write();

-- Moving a task to another project carries its subtasks with it.
create or replace function public.tasks_cascade_project_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id then
    update public.tasks
       set project_id = new.project_id
     where parent_task_id = new.id;
  end if;
  return null;
end;
$$;

-- Parent-first ordering matters: the BEFORE trigger on each child checks
-- the parent's (already updated) project.
create trigger tasks_cascade_project_move
  after update of project_id on public.tasks
  for each row execute function public.tasks_cascade_project_move();

-- ---------------------------------------------------------------------
-- 7. Assignments (many people per task)
-- ---------------------------------------------------------------------
create table public.task_assignees (
  task_id      uuid not null references public.tasks (id) on delete cascade,
  person_id    uuid not null references public.people (id) on delete cascade,
  assigned_by  uuid references auth.users (id) on delete set null default auth.uid(),
  assigned_at  timestamptz not null default now(),
  primary key (task_id, person_id)
);
create index task_assignees_person_idx on public.task_assignees (person_id);
create index task_assignees_assigned_by_idx on public.task_assignees (assigned_by);

-- The person must belong to the same workspace as the task.
create or replace function public.task_assignees_check_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select workspace_id from public.tasks where id = new.task_id)
     is distinct from
     (select workspace_id from public.people where id = new.person_id) then
    raise exception 'Person and task belong to different workspaces';
  end if;
  return new;
end;
$$;

create trigger task_assignees_check_workspace
  before insert or update on public.task_assignees
  for each row execute function public.task_assignees_check_workspace();

-- ---------------------------------------------------------------------
-- 8. Labels
-- ---------------------------------------------------------------------
create table public.labels (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  color        text not null default '#94A3B8',
  created_at   timestamptz not null default now(),
  unique (workspace_id, name)
);

create trigger labels_lock_workspace before update of workspace_id on public.labels
  for each row execute function public.prevent_workspace_change();

create table public.task_labels (
  task_id  uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (task_id, label_id)
);
create index task_labels_label_idx on public.task_labels (label_id);

-- ---------------------------------------------------------------------
-- 9. Comments
-- ---------------------------------------------------------------------
create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  author_id   uuid not null references auth.users (id) on delete cascade default auth.uid(),
  body        text not null check (char_length(body) between 1 and 10000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);
create index task_comments_author_idx on public.task_comments (author_id);

create trigger task_comments_updated_at before update on public.task_comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 10. Activity history (written only by triggers)
-- ---------------------------------------------------------------------
create table public.task_activity (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  task_id      uuid,                -- no FK: history survives task deletion
  actor_id     uuid references auth.users (id) on delete set null,
  action       text not null,       -- created | updated | deleted | assigned | unassigned
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index task_activity_task_idx on public.task_activity (task_id, created_at desc);
create index task_activity_project_idx on public.task_activity (project_id, created_at desc);
create index task_activity_workspace_idx on public.task_activity (workspace_id, created_at desc);
create index task_activity_actor_idx on public.task_activity (actor_id);

create or replace function private.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (workspace_id, project_id, task_id, actor_id, action, details)
    values (new.workspace_id, new.project_id, new.id, auth.uid(), 'created',
            jsonb_build_object('title', new.title, 'parent_task_id', new.parent_task_id));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.title       is distinct from old.title       then changes := changes || jsonb_build_object('title',      jsonb_build_array(old.title, new.title)); end if;
    if new.status      is distinct from old.status      then changes := changes || jsonb_build_object('status',     jsonb_build_array(old.status, new.status)); end if;
    if new.priority    is distinct from old.priority    then changes := changes || jsonb_build_object('priority',   jsonb_build_array(old.priority, new.priority)); end if;
    if new.due_date    is distinct from old.due_date    then changes := changes || jsonb_build_object('due_date',   jsonb_build_array(old.due_date, new.due_date)); end if;
    if new.project_id  is distinct from old.project_id  then changes := changes || jsonb_build_object('project_id', jsonb_build_array(old.project_id, new.project_id)); end if;
    if changes <> '{}'::jsonb then
      insert into public.task_activity (workspace_id, project_id, task_id, actor_id, action, details)
      values (new.workspace_id, new.project_id, new.id, auth.uid(), 'updated', changes);
    end if;
    return new;
  else
    -- Skip when the whole project is being deleted (cascade).
    if exists (select 1 from public.projects where id = old.project_id) then
      insert into public.task_activity (workspace_id, project_id, task_id, actor_id, action, details)
      values (old.workspace_id, old.project_id, old.id, auth.uid(), 'deleted',
              jsonb_build_object('title', old.title));
    end if;
    return old;
  end if;
end;
$$;

create trigger tasks_activity
  after insert or update or delete on public.tasks
  for each row execute function private.log_task_activity();

create or replace function private.log_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  t record;
begin
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  select workspace_id, project_id into t from public.tasks where id = r.task_id;
  if t is null then return null; end if;   -- task itself is being deleted
  insert into public.task_activity (workspace_id, project_id, task_id, actor_id, action, details)
  values (t.workspace_id, t.project_id, r.task_id, auth.uid(),
          case when tg_op = 'INSERT' then 'assigned' else 'unassigned' end,
          jsonb_build_object('person_id', r.person_id));
  return null;
end;
$$;

create trigger task_assignees_activity
  after insert or delete on public.task_assignees
  for each row execute function private.log_assignment_activity();

-- ---------------------------------------------------------------------
-- 11. Onboarding automation
-- ---------------------------------------------------------------------
-- New sign-up → profile + personal workspace (as owner).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (new.id, display_name, new.email, new.raw_user_meta_data ->> 'avatar_url');

  -- on_workspace_created adds the owner membership (and a People entry).
  insert into public.workspaces (name, owner_id)
  values (display_name || '''s workspace', new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Creating a workspace from the app makes the creator its owner.
create or replace function private.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function private.handle_new_workspace();

-- Every workspace member is also an assignable person. If a person with
-- the same email already exists (added before they signed up), link it.
create or replace function private.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = new.user_id;

  update public.people
     set user_id = new.user_id
   where workspace_id = new.workspace_id
     and user_id is null
     and p.email is not null
     and lower(email) = lower(p.email);

  if not found then
    insert into public.people (workspace_id, user_id, full_name, email)
    values (new.workspace_id, new.user_id, coalesce(p.full_name, p.email, 'Member'), p.email)
    on conflict (workspace_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_workspace_member_added
  after insert on public.workspace_members
  for each row execute function private.handle_new_member();

-- ---------------------------------------------------------------------
-- 12. Views (security_invoker → they obey the caller's RLS)
-- ---------------------------------------------------------------------
create view public.project_progress
with (security_invoker = true) as
select
  p.id                                                          as project_id,
  p.workspace_id,
  count(t.id)                                                   as total_tasks,
  count(t.id) filter (where t.status = 'done')                  as done_tasks,
  count(t.id) filter (where t.status <> 'done'
                        and t.due_date < current_date)          as overdue_tasks,
  coalesce(round(100.0 * count(t.id) filter (where t.status = 'done')
                 / nullif(count(t.id), 0)), 0)::int             as percent_complete
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id, p.workspace_id;

create view public.task_subtask_counts
with (security_invoker = true) as
select
  parent_task_id                                  as task_id,
  count(*)                                        as subtasks_total,
  count(*) filter (where status = 'done')         as subtasks_done
from public.tasks
where parent_task_id is not null
group by parent_task_id;

-- Tasks assigned to the signed-in user, across every workspace.
create view public.my_tasks
with (security_invoker = true) as
select t.*
from public.tasks t
where exists (
  select 1
  from public.task_assignees a
  join public.people pe on pe.id = a.person_id
  where a.task_id = t.id and pe.user_id = (select auth.uid())
);

-- ---------------------------------------------------------------------
-- 13. Row-level security
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.people            enable row level security;
alter table public.projects          enable row level security;
alter table public.tasks             enable row level security;
alter table public.task_assignees    enable row level security;
alter table public.labels            enable row level security;
alter table public.task_labels       enable row level security;
alter table public.task_comments     enable row level security;
alter table public.task_activity     enable row level security;

-- profiles: yourself, plus anyone you share a workspace with
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members a
      join public.workspace_members b on a.workspace_id = b.workspace_id
      where a.user_id = (select auth.uid()) and b.user_id = profiles.id
    )
  );
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces
create policy "workspaces_select" on public.workspaces for select to authenticated
  using (private.is_workspace_member(id) or owner_id = (select auth.uid()));
create policy "workspaces_insert" on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "workspaces_update" on public.workspaces for update to authenticated
  using (private.can_admin_workspace(id)) with check (private.can_admin_workspace(id));
create policy "workspaces_delete" on public.workspaces for delete to authenticated
  using (owner_id = (select auth.uid()));

-- workspace_members: members can see the roster; admins manage it;
-- anyone can leave (delete their own row) except the owner.
create policy "members_select" on public.workspace_members for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "members_insert" on public.workspace_members for insert to authenticated
  with check (private.can_admin_workspace(workspace_id) and role <> 'owner');
create policy "members_update" on public.workspace_members for update to authenticated
  using (private.can_admin_workspace(workspace_id) and role <> 'owner')
  with check (private.can_admin_workspace(workspace_id) and role <> 'owner');
create policy "members_delete" on public.workspace_members for delete to authenticated
  using (
    role <> 'owner'
    and (private.can_admin_workspace(workspace_id) or user_id = (select auth.uid()))
  );

-- people
create policy "people_select" on public.people for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "people_insert" on public.people for insert to authenticated
  with check (private.can_edit_workspace(workspace_id));
create policy "people_update" on public.people for update to authenticated
  using (private.can_edit_workspace(workspace_id)) with check (private.can_edit_workspace(workspace_id));
create policy "people_delete" on public.people for delete to authenticated
  using (private.can_admin_workspace(workspace_id));

-- projects
create policy "projects_select" on public.projects for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "projects_insert" on public.projects for insert to authenticated
  with check (private.can_edit_workspace(workspace_id));
create policy "projects_update" on public.projects for update to authenticated
  using (private.can_edit_workspace(workspace_id)) with check (private.can_edit_workspace(workspace_id));
create policy "projects_delete" on public.projects for delete to authenticated
  using (private.can_admin_workspace(workspace_id));

-- tasks (workspace_id is filled from the project by trigger, so checks
-- go through the project to stop a client spoofing workspace_id)
create policy "tasks_select" on public.tasks for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "tasks_insert" on public.tasks for insert to authenticated
  with check (private.can_edit_workspace((select p.workspace_id from public.projects p where p.id = project_id)));
create policy "tasks_update" on public.tasks for update to authenticated
  using (private.can_edit_workspace(workspace_id))
  with check (private.can_edit_workspace((select p.workspace_id from public.projects p where p.id = project_id)));
create policy "tasks_delete" on public.tasks for delete to authenticated
  using (private.can_edit_workspace(workspace_id));

-- task_assignees
create policy "assignees_select" on public.task_assignees for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and private.is_workspace_member(t.workspace_id)));
create policy "assignees_insert" on public.task_assignees for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id and private.can_edit_workspace(t.workspace_id)));
create policy "assignees_delete" on public.task_assignees for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and private.can_edit_workspace(t.workspace_id)));

-- labels
create policy "labels_select" on public.labels for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "labels_insert" on public.labels for insert to authenticated
  with check (private.can_edit_workspace(workspace_id));
create policy "labels_update" on public.labels for update to authenticated
  using (private.can_edit_workspace(workspace_id)) with check (private.can_edit_workspace(workspace_id));
create policy "labels_delete" on public.labels for delete to authenticated
  using (private.can_edit_workspace(workspace_id));

-- task_labels
create policy "task_labels_select" on public.task_labels for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and private.is_workspace_member(t.workspace_id)));
create policy "task_labels_insert" on public.task_labels for insert to authenticated
  with check (
    exists (select 1 from public.tasks t join public.labels l on l.id = label_id
            where t.id = task_id and l.workspace_id = t.workspace_id
              and private.can_edit_workspace(t.workspace_id))
  );
create policy "task_labels_delete" on public.task_labels for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and private.can_edit_workspace(t.workspace_id)));

-- task_comments: any member (viewers included) may comment; only the
-- author edits; author or an admin deletes.
create policy "comments_select" on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and private.is_workspace_member(t.workspace_id)));
create policy "comments_insert" on public.task_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and private.is_workspace_member(t.workspace_id))
  );
create policy "comments_update" on public.task_comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "comments_delete" on public.task_comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (select 1 from public.tasks t where t.id = task_id and private.can_admin_workspace(t.workspace_id))
  );

-- task_activity: read-only for members (rows come from triggers)
create policy "activity_select" on public.task_activity for select to authenticated
  using (private.is_workspace_member(workspace_id));

-- Lock down functions: policy helpers callable only by signed-in users,
-- trigger functions by nobody directly.
revoke execute on all functions in schema private from public, anon, authenticated;
grant  execute on function private.is_workspace_member(uuid)  to authenticated;
grant  execute on function private.can_edit_workspace(uuid)   to authenticated;
grant  execute on function private.can_admin_workspace(uuid)  to authenticated;
revoke execute on all functions in schema public from public, anon;

-- Signed-out visitors get no table access at all (RLS would block them
-- anyway; this is defence in depth). Signed-in users get table access,
-- and RLS decides which rows.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------
-- 14. Realtime — live updates across phone, tablet and computer
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime
      add table public.projects, public.tasks, public.task_assignees,
                public.task_comments, public.people, public.labels, public.task_labels;
  end if;
end;
$$;
