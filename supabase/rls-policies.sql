-- CuePoint: Row Level Security for tenant isolation
-- Run in Supabase SQL Editor (production). Review before applying.
--
-- WHY: The Vite app uses the public anon key. Without RLS, any client can
-- read/write every row in user_data. Service-role API routes bypass RLS by design.

-- ── user_data ──────────────────────────────────────────────────────────────

alter table if exists public.user_data enable row level security;
alter table if exists public.user_data force row level security;

-- Drop loose policies if re-running (safe no-ops when missing)
drop policy if exists "user_data_select_own" on public.user_data;
drop policy if exists "user_data_insert_own" on public.user_data;
drop policy if exists "user_data_update_own" on public.user_data;
drop policy if exists "user_data_delete_own" on public.user_data;

create policy "user_data_select_own"
  on public.user_data for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_data_insert_own"
  on public.user_data for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_data_update_own"
  on public.user_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_data_delete_own"
  on public.user_data for delete
  to authenticated
  using (auth.uid() = user_id);

-- Anon has no policies → no direct table access (portal/booking go through service role APIs)

-- ── ical_feeds ─────────────────────────────────────────────────────────────

alter table if exists public.ical_feeds enable row level security;
alter table if exists public.ical_feeds force row level security;

drop policy if exists "ical_feeds_select_own" on public.ical_feeds;
drop policy if exists "ical_feeds_insert_own" on public.ical_feeds;
drop policy if exists "ical_feeds_update_own" on public.ical_feeds;
drop policy if exists "ical_feeds_delete_own" on public.ical_feeds;

-- Authenticated DJs manage only their own publish rows.
-- Public ICS download uses the service-role API with a secret token (bypasses RLS).

create policy "ical_feeds_select_own"
  on public.ical_feeds for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ical_feeds_insert_own"
  on public.ical_feeds for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ical_feeds_update_own"
  on public.ical_feeds for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ical_feeds_delete_own"
  on public.ical_feeds for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── launch_signups (if table exists) ───────────────────────────────────────
-- Public inserts go through /api/notify-launch (service role). No anon writes.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'launch_signups'
  ) then
    execute 'alter table public.launch_signups enable row level security';
    execute 'alter table public.launch_signups force row level security';
    -- No policies for anon/authenticated → only service role can read/write
  end if;
end $$;

-- ── Indexes that help ownership checks ─────────────────────────────────────

create index if not exists user_data_user_id_key_idx
  on public.user_data (user_id, key);

create index if not exists ical_feeds_user_id_idx
  on public.ical_feeds (user_id);

-- ── Verification queries (run as a normal authenticated user in SQL, or via anon client) ──
-- select * from user_data;           -- should only return your rows
-- select * from user_data where user_id = '<other-uuid>';  -- should return 0 rows
