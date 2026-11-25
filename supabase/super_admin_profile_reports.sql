-- Super Admin Profile Reports Authorization & Audit Log Policies for Nimmi Matrimony
-- Run this idempotent script in the Supabase SQL Editor for your existing project.
-- Notes:
--   1. Does NOT create duplicate profile tables or disable Row Level Security (RLS).
--   2. Uses the existing `public.admin_users`, `public.profiles`, and `public.admin_audit_logs` tables.
--   3. Enforces `super_admin` authorization at the database layer via `public.is_super_admin()`.

-- 1. Security-definer helper verifying strictly `role = 'super_admin'` in `public.admin_users`
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND lower(coalesce(au.role, '')) = 'super_admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- 2. Protect `public.admin_audit_logs` so Super Admins can record and review export audit events
-- (No personal member data is written to audit logs; only admin ID, export type, timestamp, and filter scope.)
DO $$
BEGIN
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Super admins can insert export audit logs" ON public.admin_audit_logs;
    CREATE POLICY "Super admins can insert export audit logs"
    ON public.admin_audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

    DROP POLICY IF EXISTS "Super admins can view audit logs" ON public.admin_audit_logs;
    CREATE POLICY "Super admins can view audit logs"
    ON public.admin_audit_logs
    FOR SELECT
    TO authenticated
    USING (public.is_super_admin());
  END IF;
END $$;

-- 3. Recommended server-side guard: ensure related private profile tables are accessible to `super_admin`
-- (Preserves existing member self-access and existing admin moderation policies if already configured.)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['family_details', 'education', 'jataka_details', 'profile_preferences'] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Super admins can read %s for reports" ON public.%I;', tbl, tbl);
      EXECUTE format(
        'CREATE POLICY "Super admins can read %s for reports" ON public.%I FOR SELECT TO authenticated USING (public.is_super_admin());',
        tbl,
        tbl
      );
    END IF;
  END LOOP;
END $$;
