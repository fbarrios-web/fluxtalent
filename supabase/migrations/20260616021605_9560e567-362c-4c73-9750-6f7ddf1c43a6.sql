
-- Fix search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Revoke execute on definer functions from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM public, anon;

-- Replace overly-permissive org insert policy
DROP POLICY IF EXISTS "Auth users create org" ON public.organizations;
CREATE POLICY "Auth users create org" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Storage policies for cvs bucket (private, signed URLs)
CREATE POLICY "Org members read cvs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cvs');
CREATE POLICY "Public upload cvs" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'cvs');
CREATE POLICY "Org members manage org-assets" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'org-assets') WITH CHECK (bucket_id = 'org-assets');
