-- Tenant isolation for CuePoint user_data (and related tables).
-- Apply in the Supabase SQL editor (production) AFTER relying on Super Admin
-- service-role listing. Service role bypasses RLS; anon/authenticated do not.
--
-- Ops checklist:
-- 1. Run this migration.
-- 2. Verify as a normal user: cross-tenant SELECT returns 0 rows.
-- 3. Move entitlements to app_metadata (see docs/SECURITY_AUDIT.md).
-- 4. Set Super Admin only via Auth Admin API → app_metadata.role = 'superadmin'.

-- ---------------------------------------------------------------------------
-- user_data: one row per (user_id, key) blob
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_data_select_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_insert_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_update_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_delete_own" ON public.user_data;

CREATE POLICY "user_data_select_own"
  ON public.user_data FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_data_insert_own"
  ON public.user_data FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_data_update_own"
  ON public.user_data FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_data_delete_own"
  ON public.user_data FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ical_feeds (if present): owner-only when user_id column exists
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ical_feeds' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.ical_feeds ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "ical_feeds_select_own" ON public.ical_feeds';
    EXECUTE 'DROP POLICY IF EXISTS "ical_feeds_insert_own" ON public.ical_feeds';
    EXECUTE 'DROP POLICY IF EXISTS "ical_feeds_update_own" ON public.ical_feeds';
    EXECUTE 'DROP POLICY IF EXISTS "ical_feeds_delete_own" ON public.ical_feeds';
    EXECUTE $p$
      CREATE POLICY "ical_feeds_select_own"
        ON public.ical_feeds FOR SELECT TO authenticated
        USING (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY "ical_feeds_insert_own"
        ON public.ical_feeds FOR INSERT TO authenticated
        WITH CHECK (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY "ical_feeds_update_own"
        ON public.ical_feeds FOR UPDATE TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY "ical_feeds_delete_own"
        ON public.ical_feeds FOR DELETE TO authenticated
        USING (user_id = auth.uid())
    $p$;
  END IF;
END $$;

-- Optional: revoke direct table grants from anon (API uses service role for public routes)
-- REVOKE ALL ON public.user_data FROM anon;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;
