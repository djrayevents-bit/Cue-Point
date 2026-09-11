-- CuePoint RLS baseline for private / single-owner deployments
-- MANUAL: run in Supabase SQL editor after review. Not applied automatically.
-- Goal: authenticated users can only touch their own user_data / ical_feeds rows.
-- Service role (server APIs) bypasses RLS by design — keep it server-only.

-- ========== user_data ==========
alter table if exists public.user_data enable row level security;

drop policy if exists "user_data_select_own" on public.user_data;
drop policy if exists "user_data_insert_own" on public.user_data;
drop policy if exists "user_data_update_own" on public.user_data;
drop policy if exists "user_data_delete_own" on public.user_data;

create policy "user_data_select_own"
  on public.user_data for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_data_insert_own"
  on public.user_data for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_data_update_own"
  on public.user_data for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_data_delete_own"
  on public.user_data for delete
  to authenticated
  using (user_id = auth.uid());

-- ========== ical_feeds (if present) ==========
alter table if exists public.ical_feeds enable row level security;

drop policy if exists "ical_feeds_select_own" on public.ical_feeds;
drop policy if exists "ical_feeds_insert_own" on public.ical_feeds;
drop policy if exists "ical_feeds_update_own" on public.ical_feeds;
drop policy if exists "ical_feeds_delete_own" on public.ical_feeds;

-- Public calendar GET uses service role in /api/ical/feed — no anon SELECT needed.
create policy "ical_feeds_select_own"
  on public.ical_feeds for select
  to authenticated
  using (user_id = auth.uid());

create policy "ical_feeds_insert_own"
  on public.ical_feeds for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "ical_feeds_update_own"
  on public.ical_feeds for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "ical_feeds_delete_own"
  on public.ical_feeds for delete
  to authenticated
  using (user_id = auth.uid());

-- ========== Stripe webhook idempotency (optional) ==========
create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
-- No policies for authenticated/anon — service role only.

-- ========== Auth note (dashboard / hooks — cannot fully express in SQL) ==========
-- Prefer storing plan/role in auth.users.raw_app_meta_data (app_metadata),
-- not raw_user_meta_data. Block client updates to privileged claims via Auth Hook.
