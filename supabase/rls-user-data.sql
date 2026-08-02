-- CuePoint: recommended Row Level Security for multi-tenant isolation.
-- Apply in the Supabase SQL editor after reviewing. Service-role API routes
-- bypass RLS; the anon/authenticated client must not.

-- ---------------------------------------------------------------------------
-- user_data: each user may only touch their own rows
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_data_select_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_insert_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_update_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_delete_own" ON public.user_data;

CREATE POLICY "user_data_select_own" ON public.user_data
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_data_insert_own" ON public.user_data
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_data_update_own" ON public.user_data
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_data_delete_own" ON public.user_data
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ical_feeds (if present): own rows only
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ical_feeds'
  ) THEN
    EXECUTE 'ALTER TABLE public.ical_feeds ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "ical_feeds_select_own" ON public.ical_feeds';
    EXECUTE 'DROP POLICY IF EXISTS "ical_feeds_insert_own" ON public.ical_feeds';
    EXECUTE 'DROP POLICY IF EXISTS "ical_feeds_update_own" ON public.ical_feeds';
    EXECUTE 'DROP POLICY IF EXISTS "ical_feeds_delete_own" ON public.ical_feeds';
    EXECUTE $p$
      CREATE POLICY "ical_feeds_select_own" ON public.ical_feeds
        FOR SELECT TO authenticated USING (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY "ical_feeds_insert_own" ON public.ical_feeds
        FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY "ical_feeds_update_own" ON public.ical_feeds
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY "ical_feeds_delete_own" ON public.ical_feeds
        FOR DELETE TO authenticated USING (user_id = auth.uid())
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- launch_notify_signups: no client access (API uses service role)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'launch_notify_signups'
  ) THEN
    EXECUTE 'ALTER TABLE public.launch_notify_signups ENABLE ROW LEVEL SECURITY';
    -- No policies for authenticated/anon → deny by default when RLS is on.
  END IF;
END $$;

-- After applying: set Super Admin via Dashboard → Authentication → user →
-- app_metadata: { "role": "superadmin" }. Never put role in user_metadata.
