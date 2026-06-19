
-- 1) Scope admin user_roles management to the same org
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Admins manage roles in same org"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.org_id = public.current_org_id()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.org_id = public.current_org_id()
  )
);

-- 2) Add INSERT/UPDATE storage policies for cvs bucket scoped to uploader's org
DROP POLICY IF EXISTS "Org members insert own cvs" ON storage.objects;
CREATE POLICY "Org members insert own cvs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cvs'
  AND (NULLIF(split_part(name, '/', 1), ''))::uuid = public.current_org_id()
);

DROP POLICY IF EXISTS "Org members update own cvs" ON storage.objects;
CREATE POLICY "Org members update own cvs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cvs'
  AND ((NULLIF(split_part(name, '/', 1), ''))::uuid = public.current_org_id()
       OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  bucket_id = 'cvs'
  AND ((NULLIF(split_part(name, '/', 1), ''))::uuid = public.current_org_id()
       OR public.has_role(auth.uid(), 'admin'))
);

-- 3) Restrict EXECUTE on SECURITY DEFINER functions to least-privilege roles
-- Revoke broad PUBLIC execute, then grant only where appropriate.

REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_org_billing_tamper() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_subscription_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.root_org_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.identity_exists(text, text, date) FROM PUBLIC, anon;

-- Public-facing RPCs called from public application/booking flows
REVOKE EXECUTE ON FUNCTION public.get_public_vacancy_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_vacancy_by_slug(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_booking_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.reserve_slot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_slot(uuid, uuid) TO anon, authenticated;
