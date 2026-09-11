-- CuePoint: iCal feed expiry / revocation columns.
-- MANUAL: run in Supabase SQL editor after review.
-- GET /api/ical/feed rejects revoked/expired rows when these columns exist.
-- Lifecycle is also enforced via user_data.calendarToken structured entries.

alter table if exists public.ical_feeds
  add column if not exists expires_at timestamptz;

alter table if exists public.ical_feeds
  add column if not exists revoked_at timestamptz;

comment on column public.ical_feeds.expires_at is 'Optional feed expiry; null = use calendarToken entry / no column-level expiry';
comment on column public.ical_feeds.revoked_at is 'When set, GET rejects this token until republished with a new token';
