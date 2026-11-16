-- Categories group projects (for example Work or Personal). A project may belong to one category.
-- Members of a workspace can read categories; editors can create, rename and delete them.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create index categories_workspace_idx on public.categories (workspace_id);

alter table public.categories enable row level security;

revoke all on public.categories from anon;
grant select, insert, update, delete on public.categories to authenticated;

create policy "categories_select" on public.categories for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy "categories_insert" on public.categories for insert to authenticated
  with check (private.can_edit_workspace(workspace_id));

create policy "categories_update" on public.categories for update to authenticated
  using (private.can_edit_workspace(workspace_id))
  with check (private.can_edit_workspace(workspace_id));

create policy "categories_delete" on public.categories for delete to authenticated
  using (private.can_edit_workspace(workspace_id));

alter table public.projects
  add column category_id uuid references public.categories (id) on delete set null;

create index projects_category_idx on public.projects (category_id);
