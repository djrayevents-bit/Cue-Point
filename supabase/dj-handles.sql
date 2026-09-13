-- CuePoint: O(1) public handle lookup (booking + meetings).
-- MANUAL: run in Supabase SQL editor after review.
-- APIs also backfill user_data keys `djHandle:<norm>` without this table.

create table if not exists public.dj_handles (
  handle text primary key, -- already normalized [a-z0-9]+
  user_id uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index if not exists dj_handles_user_id_idx on public.dj_handles (user_id);

alter table public.dj_handles enable row level security;

drop policy if exists "dj_handles_select_own" on public.dj_handles;
drop policy if exists "dj_handles_insert_own" on public.dj_handles;
drop policy if exists "dj_handles_update_own" on public.dj_handles;
drop policy if exists "dj_handles_delete_own" on public.dj_handles;

-- Authenticated owner can manage their own handle rows.
-- Public booking APIs use the service role (bypasses RLS).
create policy "dj_handles_select_own"
  on public.dj_handles for select
  to authenticated
  using (user_id = auth.uid());

create policy "dj_handles_insert_own"
  on public.dj_handles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "dj_handles_update_own"
  on public.dj_handles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "dj_handles_delete_own"
  on public.dj_handles for delete
  to authenticated
  using (user_id = auth.uid());

-- Optional one-time backfill from existing djProfile blobs (service role / SQL editor):
-- insert into public.dj_handles (handle, user_id)
-- select distinct lower(regexp_replace(coalesce(
--   value->>'subdomain', value->>'bookingHandle', value->>'djName', value->>'businessName', ''
-- ), '[^a-z0-9]', '', 'g')), user_id
-- from public.user_data
-- where key = 'djProfile'
--   and length(regexp_replace(coalesce(
--     value->>'subdomain', value->>'bookingHandle', value->>'djName', value->>'businessName', ''
--   ), '[^a-z0-9]', '', 'g')) > 0
-- on conflict (handle) do update set user_id = excluded.user_id, updated_at = now();
