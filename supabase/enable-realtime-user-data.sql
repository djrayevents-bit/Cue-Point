-- Enable Supabase Realtime for cross-device live sync (run once in SQL Editor)
-- Dashboard → Database → Replication → user_data should also show this table enabled.

alter publication supabase_realtime add table public.user_data;
