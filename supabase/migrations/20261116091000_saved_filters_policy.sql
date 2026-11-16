-- Saved filters: anonymous users get nothing, and a filter can only be saved
-- into a workspace the owner belongs to.
revoke all on public.saved_filters from anon;

drop policy if exists "saved filters are private to their owner" on public.saved_filters;

create policy "saved filters are private to their owner"
  on public.saved_filters for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = saved_filters.workspace_id
        and m.user_id = (select auth.uid())
    )
  );
