DROP POLICY IF EXISTS "Org members read profiles" ON public.profiles;
CREATE POLICY "Org members read profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND org_id = public.current_org_id());