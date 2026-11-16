-- Saved list filters. Each person sees only their own. scope is 'all' or a project id.
create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  scope text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.saved_filters enable row level security;

create policy "saved filters are private to their owner"
  on public.saved_filters for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create index if not exists saved_filters_owner_idx on public.saved_filters (owner_id, scope);
