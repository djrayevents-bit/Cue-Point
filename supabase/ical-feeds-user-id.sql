-- Bind iCal feeds to the authenticated DJ (run once in Supabase SQL editor if needed).
-- Public GET /api/ical/feed?token=… still works; only POST publish requires auth + ownership.

alter table if exists public.ical_feeds
  add column if not exists user_id uuid references auth.users (id);

create index if not exists ical_feeds_user_id_idx on public.ical_feeds (user_id);
