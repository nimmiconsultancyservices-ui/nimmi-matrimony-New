-- Admin & Staff User Management + Granular Permission System for Nimmi Matrimony
-- Run this idempotent script in the Supabase SQL Editor for your existing project.
-- Guarantees:
--   1. Preserves ALL existing Super Admin, Admin, and Moderator accounts and login flows.
--   2. Safely extends `public.admin_users` (no duplicate user/admin tables created).
--   3. Inspects and updates the role CHECK constraint to support: super_admin, admin, staff, moderator.
--   4. Creates `public.admin_permissions` and `public.admin_user_permissions` with UUID FKs, unique constraints, indexes, and RLS.
--   5. Implements hardened `public.is_super_admin()`, `public.is_admin()`, `public.has_permission(text)`, and `public.get_my_admin_access()`.
--   6. Enforces module & action permissions across RLS policies and audit logging.

-- ============================================================================
-- 1. Safely Extend `public.admin_users` & Update Role Check Constraint
-- ============================================================================
DO $$
DECLARE
  v_constraint_name text;
  v_has_unique_uid boolean := false;
BEGIN
  IF to_regclass('public.admin_users') IS NULL THEN
    RAISE EXCEPTION 'Expected existing table public.admin_users was not found.';
  END IF;

  -- Add non-destructive metadata & lifecycle columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN full_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'mobile'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN mobile text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN created_by uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'deactivated_at'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN deactivated_at timestamptz;
  END IF;

  -- Ensure existing rows remain active and lowercase-normalized without changing role identity
  UPDATE public.admin_users
  SET
    is_active = coalesce(is_active, true),
    role = lower(trim(role))
  WHERE role IS NOT NULL
    AND (is_active IS NULL OR role <> lower(trim(role)));

  -- Ensure a unique constraint or PK exists on `user_id` so permission FKs can reference it cleanly
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.admin_users'::regclass
      AND c.contype IN ('p', 'u')
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'user_id'
  ) INTO v_has_unique_uid;

  IF NOT v_has_unique_uid THEN
    ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_user_id_unique UNIQUE (user_id);
  END IF;

  -- Inspect existing CHECK constraints referencing `role` and drop them safely by exact constraint name
  FOR v_constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.admin_users'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS %I;', v_constraint_name);
  END LOOP;

  -- Re-create role constraint supporting super_admin, admin, staff, and moderator
  ALTER TABLE public.admin_users
    ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('super_admin', 'admin', 'staff', 'moderator'));
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_users_role_active
  ON public.admin_users (role, is_active);

CREATE INDEX IF NOT EXISTS idx_admin_users_created_at
  ON public.admin_users (created_at DESC);

-- ============================================================================
-- 2. Permission Definitions & Assignments Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL UNIQUE,
  module_key text NOT NULL,
  module_label text NOT NULL,
  action_key text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_module_action
  ON public.admin_permissions (module_key, action_key);

CREATE TABLE IF NOT EXISTS public.admin_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(user_id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.admin_permissions(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_user_permissions_unique UNIQUE (admin_user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_permissions_admin_user_id
  ON public.admin_user_permissions (admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_user_permissions_permission_id
  ON public.admin_user_permissions (permission_id);

-- Seed canonical granular module permissions (idempotent upsert)
INSERT INTO public.admin_permissions (permission_key, module_key, module_label, action_key, description, sort_order)
VALUES
  -- Dashboard
  ('dashboard.view', 'dashboard', 'Dashboard', 'view', 'View admin dashboard overview KPIs and queues', 10),

  -- Profiles Management & Moderation (canonical keys used by moderate_profile_status & UI)
  ('profiles.view', 'profiles', 'Profiles Management & Moderation', 'view', 'View profile management list and inspect member profiles', 15),
  ('profiles.edit', 'profiles', 'Profiles Management & Moderation', 'edit', 'Edit member profile details and ID verification status', 16),
  ('profiles.approve', 'profiles', 'Profiles Management & Moderation', 'approve', 'Approve member profiles via moderate_profile_status', 17),
  ('profiles.reject', 'profiles', 'Profiles Management & Moderation', 'reject', 'Reject or block member profiles via moderate_profile_status', 18),

  -- Profile Management (legacy compatibility)
  ('profile_management.view', 'profile_management', 'Profile Management', 'view', 'View and search member profiles', 20),
  ('profile_management.create', 'profile_management', 'Profile Management', 'create', 'Create new member profiles from Admin Console', 21),
  ('profile_management.edit', 'profile_management', 'Profile Management', 'edit', 'Edit member profile details and ID verification status', 22),
  ('profile_management.delete', 'profile_management', 'Profile Management', 'delete', 'Delete or permanently remove member profile records', 23),

  -- Profile Approval (legacy compatibility)
  ('profile_approval.view', 'profile_approval', 'Profile Approval', 'view', 'View profiles awaiting moderation review', 30),
  ('profile_approval.approve', 'profile_approval', 'Profile Approval', 'approve', 'Approve member profiles for public visibility', 31),
  ('profile_approval.reject', 'profile_approval', 'Profile Approval', 'reject', 'Reject or block member profiles with moderation notes', 32),

  -- Photo Approval
  ('photo_approval.view', 'photo_approval', 'Photo Approval', 'view', 'View submitted member photos in moderation queue', 40),
  ('photo_approval.approve', 'photo_approval', 'Photo Approval', 'approve', 'Approve member photos for display', 41),
  ('photo_approval.reject', 'photo_approval', 'Photo Approval', 'reject', 'Reject inappropriate or unverified member photos', 42),
  ('photo_approval.delete', 'photo_approval', 'Photo Approval', 'delete', 'Delete flagged member photos', 43),

  -- Reports Management
  ('reports_management.view', 'reports_management', 'Reports Management', 'view', 'View abuse and safety reports submitted by members', 50),
  ('reports_management.edit', 'reports_management', 'Reports Management', 'edit', 'Update report investigation notes and Under Review status', 51),
  ('reports_management.approve', 'reports_management', 'Reports Management', 'approve', 'Resolve reports and enforce member profile moderation actions', 52),
  ('reports_management.reject', 'reports_management', 'Reports Management', 'reject', 'Dismiss invalid or duplicate reports', 53),

  -- Membership Management
  ('membership_management.view', 'membership_management', 'Membership Management', 'view', 'View membership plan tiers and configurations', 60),
  ('membership_management.create', 'membership_management', 'Membership Management', 'create', 'Create new membership plans', 61),
  ('membership_management.edit', 'membership_management', 'Membership Management', 'edit', 'Edit membership plan pricing, duration, and active state', 62),
  ('membership_management.delete', 'membership_management', 'Membership Management', 'delete', 'Delete membership plans', 63),

  -- Subscription Management
  ('subscription_management.view', 'subscription_management', 'Subscription Management', 'view', 'View member subscription requests and active plans', 70),
  ('subscription_management.approve', 'subscription_management', 'Subscription Management', 'approve', 'Activate pending member subscriptions', 71),
  ('subscription_management.reject', 'subscription_management', 'Subscription Management', 'reject', 'Cancel pending or active subscriptions', 72),

  -- Payment Management
  ('payment_management.view', 'payment_management', 'Payment Management', 'view', 'View payment transactions and verification records', 80),
  ('payment_management.create', 'payment_management', 'Payment Management', 'create', 'Record manual or offline payment entries', 81),
  ('payment_management.edit', 'payment_management', 'Payment Management', 'edit', 'Update payment metadata and reconciliation notes', 82),
  ('payment_management.approve', 'payment_management', 'Payment Management', 'approve', 'Verify and approve pending payment transactions', 83),
  ('payment_management.reject', 'payment_management', 'Payment Management', 'reject', 'Reject or mark failed/refunded payment transactions', 84),

  -- Messages Management
  ('messages_management.view', 'messages_management', 'Messages Management', 'view', 'View moderated member communication logs and templates', 90),
  ('messages_management.create', 'messages_management', 'Messages Management', 'create', 'Create administrative announcements or support replies', 91),
  ('messages_management.edit', 'messages_management', 'Messages Management', 'edit', 'Edit message templates or moderation flags', 92),
  ('messages_management.delete', 'messages_management', 'Messages Management', 'delete', 'Delete policy-violating messages', 93),

  -- Community Management
  ('community_management.view', 'community_management', 'Community Management', 'view', 'View community master records', 100),
  ('community_management.create', 'community_management', 'Community Management', 'create', 'Add new communities under religions', 101),
  ('community_management.edit', 'community_management', 'Community Management', 'edit', 'Edit or toggle active state of communities', 102),
  ('community_management.delete', 'community_management', 'Community Management', 'delete', 'Remove unused community master entries', 103),

  -- Religion Management
  ('religion_management.view', 'religion_management', 'Religion Management', 'view', 'View religion master records', 110),
  ('religion_management.create', 'religion_management', 'Religion Management', 'create', 'Add new religion categories', 111),
  ('religion_management.edit', 'religion_management', 'Religion Management', 'edit', 'Rename or toggle active state of religions', 112),
  ('religion_management.delete', 'religion_management', 'Religion Management', 'delete', 'Remove unused religion master entries', 113),

  -- Education Management
  ('education_management.view', 'education_management', 'Education Management', 'view', 'View member education qualifications and records', 120),
  ('education_management.create', 'education_management', 'Education Management', 'create', 'Add standardized education records', 121),
  ('education_management.edit', 'education_management', 'Education Management', 'edit', 'Edit education master or profile academic entries', 122),
  ('education_management.delete', 'education_management', 'Education Management', 'delete', 'Delete duplicate education entries', 123),

  -- Location Management
  ('location_management.view', 'location_management', 'Location Management', 'view', 'View states, cities, and geographic master lists', 130),
  ('location_management.create', 'location_management', 'Location Management', 'create', 'Add new state or location master entries', 131),
  ('location_management.edit', 'location_management', 'Location Management', 'edit', 'Edit or toggle state/location visibility', 132),
  ('location_management.delete', 'location_management', 'Location Management', 'delete', 'Remove obsolete location master entries', 133),

  -- Member Support
  ('member_support.view', 'member_support', 'Member Support', 'view', 'View member support tickets and care requests', 140),
  ('member_support.edit', 'member_support', 'Member Support', 'edit', 'Respond to and update member support tickets', 141),
  ('member_support.approve', 'member_support', 'Member Support', 'approve', 'Resolve and close member support requests', 142),
  ('member_support.reject', 'member_support', 'Member Support', 'reject', 'Dismiss or decline invalid support requests', 143)
ON CONFLICT (permission_key) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  module_label = EXCLUDED.module_label,
  action_key = EXCLUDED.action_key,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- ============================================================================
-- 3. Hardened Authorization & Permission Checking Functions
-- ============================================================================
-- 3A. Super Admin check (strictly role = 'super_admin' AND active)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND lower(coalesce(au.role, '')) = 'super_admin'
        AND coalesce(au.is_active, true) = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- 3B. Active Admin / Staff / Moderator check (deactivated users immediately fail)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND lower(coalesce(au.role, '')) IN ('super_admin', 'admin', 'staff', 'moderator')
        AND coalesce(au.is_active, true) = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3C. Authoritative Granular Permission Check
CREATE OR REPLACE FUNCTION public.has_permission(permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_is_active boolean;
BEGIN
  IF v_uid IS NULL OR permission_key IS NULL OR trim(permission_key) = '' THEN
    RETURN false;
  END IF;

  SELECT lower(coalesce(au.role, '')), coalesce(au.is_active, true)
  INTO v_role, v_is_active
  FROM public.admin_users au
  WHERE au.user_id = v_uid
  LIMIT 1;

  IF NOT FOUND OR v_is_active IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF v_role NOT IN ('super_admin', 'admin', 'staff', 'moderator') THEN
    RETURN false;
  END IF;

  -- Super Admin always holds unrestricted access
  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Admin, Staff, and Moderator require explicit active permission assignment
  RETURN EXISTS (
    SELECT 1
    FROM public.admin_user_permissions aup
    INNER JOIN public.admin_permissions ap ON ap.id = aup.permission_id
    WHERE aup.admin_user_id = v_uid
      AND ap.permission_key = trim(permission_key)
      AND coalesce(ap.is_active, true) = true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- 3D. Authoritative Self-Access Profile + Permissions RPC for Admin Console Hydration
CREATE OR REPLACE FUNCTION public.get_my_admin_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.admin_users%ROWTYPE;
  v_perms text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'is_admin', false,
      'is_active', false,
      'role', null,
      'permissions', '[]'::jsonb
    );
  END IF;

  SELECT *
  INTO v_row
  FROM public.admin_users au
  WHERE au.user_id = v_uid
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'authenticated', true,
      'is_admin', false,
      'is_active', false,
      'role', null,
      'permissions', '[]'::jsonb
    );
  END IF;

  IF coalesce(v_row.is_active, true) = false
     OR lower(coalesce(v_row.role, '')) NOT IN ('super_admin', 'admin', 'staff', 'moderator') THEN
    RETURN jsonb_build_object(
      'authenticated', true,
      'is_admin', false,
      'is_active', coalesce(v_row.is_active, false),
      'role', lower(coalesce(v_row.role, '')),
      'full_name', v_row.full_name,
      'email', v_row.email,
      'permissions', '[]'::jsonb
    );
  END IF;

  IF lower(v_row.role) = 'super_admin' THEN
    SELECT coalesce(array_agg(ap.permission_key ORDER BY ap.sort_order), ARRAY[]::text[])
    INTO v_perms
    FROM public.admin_permissions ap
    WHERE coalesce(ap.is_active, true) = true;
  ELSE
    SELECT coalesce(array_agg(ap.permission_key ORDER BY ap.sort_order), ARRAY[]::text[])
    INTO v_perms
    FROM public.admin_user_permissions aup
    INNER JOIN public.admin_permissions ap ON ap.id = aup.permission_id
    WHERE aup.admin_user_id = v_uid
      AND coalesce(ap.is_active, true) = true;
  END IF;

  RETURN jsonb_build_object(
    'authenticated', true,
    'is_admin', true,
    'is_active', true,
    'role', lower(v_row.role),
    'full_name', v_row.full_name,
    'email', v_row.email,
    'permissions', to_jsonb(coalesce(v_perms, ARRAY[]::text[]))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_admin_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_admin_access() TO authenticated;

-- ============================================================================
-- 4. RLS Policies for Admin Users & Permission Tables
-- ============================================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive legacy policies on `admin_users` if any exist, while keeping self-read safe
DO $$
DECLARE
  v_pol record;
BEGIN
  FOR v_pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_users;', v_pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can inspect their own admin_users record"
ON public.admin_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Only super_admin can insert admin_users"
ON public.admin_users
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "Only super_admin can update admin_users"
ON public.admin_users
FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Only super_admin can delete admin_users"
ON public.admin_users
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- `admin_permissions` RLS
DROP POLICY IF EXISTS "Active admin/staff can view permission catalog" ON public.admin_permissions;
CREATE POLICY "Active admin/staff can view permission catalog"
ON public.admin_permissions
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Only super_admin can manage permission catalog" ON public.admin_permissions;
CREATE POLICY "Only super_admin can manage permission catalog"
ON public.admin_permissions
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- `admin_user_permissions` RLS
DROP POLICY IF EXISTS "Users read own permissions or super_admin reads all" ON public.admin_user_permissions;
CREATE POLICY "Users read own permissions or super_admin reads all"
ON public.admin_user_permissions
FOR SELECT
TO authenticated
USING (admin_user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Only super_admin can assign or revoke permissions" ON public.admin_user_permissions;
CREATE POLICY "Only super_admin can assign or revoke permissions"
ON public.admin_user_permissions
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- ============================================================================
-- 5. Enforce Granular Permissions in Operational Table RLS Policies
--    (Upgrades legacy `is_admin()` admin-only policies cleanly without disturbing
--     member self-service or public approved-profile read policies.)
-- ============================================================================
DO $$
DECLARE
  v_pol record;
BEGIN
  -- Remove overly broad legacy admin policies that used `is_admin()` without checking `has_permission(...)`
  FOR v_pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'profile_photos', 'reports', 'subscriptions', 'membership_plans', 'religions', 'communities')
      AND (
        coalesce(qual, '') ~* 'is_admin\s*\('
        OR coalesce(with_check, '') ~* 'is_admin\s*\('
      )
      AND coalesce(qual, '') !~* 'has_permission\s*\('
      AND coalesce(with_check, '') !~* 'has_permission\s*\('
      AND coalesce(qual, '') !~* 'is_super_admin\s*\('
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol.policyname, v_pol.tablename);
  END LOOP;
END $$;

-- Profiles RLS (admin/staff permission policies)
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Permitted admin/staff can view member profiles" ON public.profiles;
    CREATE POLICY "Permitted admin/staff can view member profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
      public.has_permission('profiles.view')
      OR public.has_permission('profile_management.view')
      OR public.has_permission('profile_approval.view')
      OR public.has_permission('photo_approval.view')
      OR public.has_permission('reports_management.view')
      OR public.has_permission('subscription_management.view')
      OR public.has_permission('dashboard.view')
    );

    DROP POLICY IF EXISTS "Permitted admin/staff can update member profiles" ON public.profiles;
    CREATE POLICY "Permitted admin/staff can update member profiles"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
      public.has_permission('profiles.edit')
      OR public.has_permission('profiles.approve')
      OR public.has_permission('profiles.reject')
      OR public.has_permission('profile_management.edit')
      OR public.has_permission('profile_approval.approve')
      OR public.has_permission('profile_approval.reject')
      OR public.has_permission('reports_management.approve')
    )
    WITH CHECK (
      public.has_permission('profiles.edit')
      OR public.has_permission('profiles.approve')
      OR public.has_permission('profiles.reject')
      OR public.has_permission('profile_management.edit')
      OR public.has_permission('profile_approval.approve')
      OR public.has_permission('profile_approval.reject')
      OR public.has_permission('reports_management.approve')
    );
  END IF;
END $$;

-- Profile Photos RLS
DO $$
BEGIN
  IF to_regclass('public.profile_photos') IS NOT NULL THEN
    ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Permitted admin/staff can view profile photos" ON public.profile_photos;
    CREATE POLICY "Permitted admin/staff can view profile photos"
    ON public.profile_photos
    FOR SELECT
    TO authenticated
    USING (
      public.has_permission('photo_approval.view')
      OR public.has_permission('profile_management.view')
      OR public.has_permission('profile_approval.view')
    );

    DROP POLICY IF EXISTS "Permitted admin/staff can moderate profile photos" ON public.profile_photos;
    CREATE POLICY "Permitted admin/staff can moderate profile photos"
    ON public.profile_photos
    FOR UPDATE
    TO authenticated
    USING (
      public.has_permission('photo_approval.approve')
      OR public.has_permission('photo_approval.reject')
    )
    WITH CHECK (
      public.has_permission('photo_approval.approve')
      OR public.has_permission('photo_approval.reject')
    );

    DROP POLICY IF EXISTS "Permitted admin/staff can delete profile photos" ON public.profile_photos;
    CREATE POLICY "Permitted admin/staff can delete profile photos"
    ON public.profile_photos
    FOR DELETE
    TO authenticated
    USING (public.has_permission('photo_approval.delete'));
  END IF;
END $$;

-- Reports RLS
DO $$
BEGIN
  IF to_regclass('public.reports') IS NOT NULL THEN
    ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Permitted admin/staff can view reports" ON public.reports;
    CREATE POLICY "Permitted admin/staff can view reports"
    ON public.reports
    FOR SELECT
    TO authenticated
    USING (public.has_permission('reports_management.view'));

    DROP POLICY IF EXISTS "Permitted admin/staff can update reports" ON public.reports;
    CREATE POLICY "Permitted admin/staff can update reports"
    ON public.reports
    FOR UPDATE
    TO authenticated
    USING (
      public.has_permission('reports_management.edit')
      OR public.has_permission('reports_management.approve')
      OR public.has_permission('reports_management.reject')
    )
    WITH CHECK (
      public.has_permission('reports_management.edit')
      OR public.has_permission('reports_management.approve')
      OR public.has_permission('reports_management.reject')
    );
  END IF;
END $$;

-- Subscriptions RLS
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Permitted admin/staff can view subscriptions" ON public.subscriptions;
    CREATE POLICY "Permitted admin/staff can view subscriptions"
    ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (public.has_permission('subscription_management.view'));

    DROP POLICY IF EXISTS "Permitted admin/staff can update subscriptions" ON public.subscriptions;
    CREATE POLICY "Permitted admin/staff can update subscriptions"
    ON public.subscriptions
    FOR UPDATE
    TO authenticated
    USING (
      public.has_permission('subscription_management.approve')
      OR public.has_permission('subscription_management.reject')
    )
    WITH CHECK (
      public.has_permission('subscription_management.approve')
      OR public.has_permission('subscription_management.reject')
    );
  END IF;
END $$;

-- Membership Plans RLS
DO $$
BEGIN
  IF to_regclass('public.membership_plans') IS NOT NULL THEN
    ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Permitted admin/staff can view all membership plans" ON public.membership_plans;
    CREATE POLICY "Permitted admin/staff can view all membership plans"
    ON public.membership_plans
    FOR SELECT
    TO authenticated
    USING (public.has_permission('membership_management.view'));

    DROP POLICY IF EXISTS "Permitted admin/staff can create membership plans" ON public.membership_plans;
    CREATE POLICY "Permitted admin/staff can create membership plans"
    ON public.membership_plans
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_permission('membership_management.create'));

    DROP POLICY IF EXISTS "Permitted admin/staff can edit membership plans" ON public.membership_plans;
    CREATE POLICY "Permitted admin/staff can edit membership plans"
    ON public.membership_plans
    FOR UPDATE
    TO authenticated
    USING (public.has_permission('membership_management.edit'))
    WITH CHECK (public.has_permission('membership_management.edit'));

    DROP POLICY IF EXISTS "Permitted admin/staff can delete membership plans" ON public.membership_plans;
    CREATE POLICY "Permitted admin/staff can delete membership plans"
    ON public.membership_plans
    FOR DELETE
    TO authenticated
    USING (public.has_permission('membership_management.delete'));
  END IF;
END $$;

-- Religions RLS
DO $$
BEGIN
  IF to_regclass('public.religions') IS NOT NULL THEN
    ALTER TABLE public.religions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Permitted admin/staff can manage religions insert" ON public.religions;
    CREATE POLICY "Permitted admin/staff can manage religions insert"
    ON public.religions
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_permission('religion_management.create'));

    DROP POLICY IF EXISTS "Permitted admin/staff can manage religions update" ON public.religions;
    CREATE POLICY "Permitted admin/staff can manage religions update"
    ON public.religions
    FOR UPDATE
    TO authenticated
    USING (public.has_permission('religion_management.edit'))
    WITH CHECK (public.has_permission('religion_management.edit'));

    DROP POLICY IF EXISTS "Permitted admin/staff can manage religions delete" ON public.religions;
    CREATE POLICY "Permitted admin/staff can manage religions delete"
    ON public.religions
    FOR DELETE
    TO authenticated
    USING (public.has_permission('religion_management.delete'));
  END IF;
END $$;

-- Communities RLS
DO $$
BEGIN
  IF to_regclass('public.communities') IS NOT NULL THEN
    ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Permitted admin/staff can manage communities insert" ON public.communities;
    CREATE POLICY "Permitted admin/staff can manage communities insert"
    ON public.communities
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_permission('community_management.create'));

    DROP POLICY IF EXISTS "Permitted admin/staff can manage communities update" ON public.communities;
    CREATE POLICY "Permitted admin/staff can manage communities update"
    ON public.communities
    FOR UPDATE
    TO authenticated
    USING (public.has_permission('community_management.edit'))
    WITH CHECK (public.has_permission('community_management.edit'));

    DROP POLICY IF EXISTS "Permitted admin/staff can manage communities delete" ON public.communities;
    CREATE POLICY "Permitted admin/staff can manage communities delete"
    ON public.communities
    FOR DELETE
    TO authenticated
    USING (public.has_permission('community_management.delete'));
  END IF;
END $$;

-- Payments / Education / States RLS (only when tables exist)
DO $$
BEGIN
  IF to_regclass('public.payments') IS NOT NULL THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Permitted admin/staff can view payments" ON public.payments;
    CREATE POLICY "Permitted admin/staff can view payments"
    ON public.payments FOR SELECT TO authenticated
    USING (public.has_permission('payment_management.view'));

    DROP POLICY IF EXISTS "Permitted admin/staff can update payments" ON public.payments;
    CREATE POLICY "Permitted admin/staff can update payments"
    ON public.payments FOR UPDATE TO authenticated
    USING (public.has_permission('payment_management.edit') OR public.has_permission('payment_management.approve') OR public.has_permission('payment_management.reject'))
    WITH CHECK (public.has_permission('payment_management.edit') OR public.has_permission('payment_management.approve') OR public.has_permission('payment_management.reject'));
  END IF;

  IF to_regclass('public.states') IS NOT NULL THEN
    ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Permitted admin/staff can manage states" ON public.states;
    CREATE POLICY "Permitted admin/staff can manage states"
    ON public.states FOR ALL TO authenticated
    USING (public.has_permission('location_management.view'))
    WITH CHECK (public.has_permission('location_management.create') OR public.has_permission('location_management.edit') OR public.has_permission('location_management.delete'));
  END IF;
END $$;

-- ============================================================================
-- 6. Protect Audit Logs (Super Admin Only Read & Write)
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Super admins can insert audit logs" ON public.admin_audit_logs;
    CREATE POLICY "Super admins can insert audit logs"
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
