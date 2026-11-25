-- Supabase Storage RLS Policies for Nimmi Matrimony (`profile-photos` bucket)
-- Run this script in the Supabase SQL Editor for your existing project.
-- Notes:
--   1. Does NOT modify `public.profile_photos` schema or delete existing Base64 rows.
--   2. Uses the existing `profile-photos` bucket and `public.is_admin()` function.
--   3. Restricts member uploads, updates, and deletes strictly to their own `<auth.uid()>/...` folder.

-- Ensure bucket `profile-photos` exists (no-op if already created; keeps existing visibility if set)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', false)
ON CONFLICT (id) DO NOTHING;

-- 1. INSERT: Authenticated members can upload only into their own `<auth.uid()>/` folder
DROP POLICY IF EXISTS "Members can upload own profile photos" ON storage.objects;
CREATE POLICY "Members can upload own profile photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. SELECT: Owners see all their own files; admins see all files; public/members see approved non-private photos
DROP POLICY IF EXISTS "View approved public, own, or admin profile photos" ON storage.objects;
CREATE POLICY "View approved public, own, or admin profile photos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'profile-photos'
  AND (
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    OR (auth.uid() IS NOT NULL AND public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.profile_photos pp
      WHERE pp.photo_url = storage.objects.name
        AND lower(pp.approval_status) = 'approved'
        AND coalesce(pp.is_private, false) = false
    )
  )
);

-- 3. UPDATE: Authenticated members can update only files inside their own `<auth.uid()>/` folder
DROP POLICY IF EXISTS "Members can update own profile photos" ON storage.objects;
CREATE POLICY "Members can update own profile photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. DELETE: Authenticated members can delete their own files; admins can delete moderated files
DROP POLICY IF EXISTS "Members can delete own profile photos" ON storage.objects;
CREATE POLICY "Members can delete own profile photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin()
  )
);
