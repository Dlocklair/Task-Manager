-- Covering index for workspaces.owner_id (flagged by the Supabase performance advisor).
create index if not exists workspaces_owner_idx on public.workspaces (owner_id);
