-- =========================================================
-- 1. CVS BUCKET: scope by org_id (first folder of path)
-- =========================================================
DROP POLICY IF EXISTS "Org members read cvs" ON storage.objects;
DROP POLICY IF EXISTS "Public upload cvs" ON storage.objects;

-- Only org members (or admin) can read CV files in their org folder
CREATE POLICY "Org members read own cvs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cvs'
  AND (
    (NULLIF(split_part(name, '/', 1), '')::uuid = public.current_org_id())
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- CV uploads only via service role (public form goes through server endpoint).
-- No anon/authenticated INSERT policy = no client-side uploads allowed.

-- Admins/owners can delete CVs from their org
CREATE POLICY "Org members delete own cvs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cvs'
  AND (
    (NULLIF(split_part(name, '/', 1), '')::uuid = public.current_org_id())
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- =========================================================
-- 2. ORG-ASSETS BUCKET: scope by org_id folder
-- =========================================================
DROP POLICY IF EXISTS "Org members manage org-assets" ON storage.objects;

CREATE POLICY "Org members read own org-assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (
    (NULLIF(split_part(name, '/', 1), '')::uuid = public.current_org_id())
    OR public.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY "Org members insert own org-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-assets'
  AND NULLIF(split_part(name, '/', 1), '')::uuid = public.current_org_id()
);
CREATE POLICY "Org members update own org-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-assets'
  AND NULLIF(split_part(name, '/', 1), '')::uuid = public.current_org_id()
)
WITH CHECK (
  bucket_id = 'org-assets'
  AND NULLIF(split_part(name, '/', 1), '')::uuid = public.current_org_id()
);
CREATE POLICY "Org members delete own org-assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'org-assets'
  AND NULLIF(split_part(name, '/', 1), '')::uuid = public.current_org_id()
);

-- =========================================================
-- 3. VACANCIES: remove broad anon SELECT, add safe RPC
-- =========================================================
DROP POLICY IF EXISTS "Public active vacancies by slug" ON public.vacancies;

CREATE OR REPLACE FUNCTION public.get_public_vacancy_by_slug(_slug TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  area TEXT,
  seniority TEXT,
  modality TEXT,
  location TEXT,
  description TEXT,
  responsibilities TEXT,
  requirements TEXT,
  nice_to_have TEXT,
  status TEXT,
  org_id UUID,
  org_name TEXT,
  screening_questions JSONB
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    v.id,
    v.title,
    v.area,
    v.seniority::text,
    v.modality::text,
    v.location,
    v.description,
    v.responsibilities,
    v.requirements,
    v.nice_to_have,
    v.status::text,
    v.org_id,
    o.name AS org_name,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'required', q.required, 'position', q.position) ORDER BY q.position)
       FROM public.screening_questions q WHERE q.vacancy_id = v.id),
      '[]'::jsonb
    ) AS screening_questions
  FROM public.vacancies v
  JOIN public.organizations o ON o.id = v.org_id
  WHERE v.public_slug = _slug AND v.status = 'active'
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_vacancy_by_slug(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_public_vacancy_by_slug(TEXT) TO anon, authenticated, service_role;

-- =========================================================
-- 4. ORGANIZATIONS: prevent non-admin from editing billing fields
-- =========================================================
CREATE OR REPLACE FUNCTION public.prevent_org_billing_tamper()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Allow service_role and admins
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.trial_ends_at      IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.plan_price_ars     IS DISTINCT FROM OLD.plan_price_ars
     OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
     OR NEW.last_payment_at    IS DISTINCT FROM OLD.last_payment_at
     OR NEW.mp_preapproval_id  IS DISTINCT FROM OLD.mp_preapproval_id
  THEN
    RAISE EXCEPTION 'Solo los administradores pueden modificar campos de facturación de la organización.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.prevent_org_billing_tamper() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_org_billing_tamper ON public.organizations;
CREATE TRIGGER trg_prevent_org_billing_tamper
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.prevent_org_billing_tamper();

-- Add explicit DELETE policy: only admins
CREATE POLICY "Admins delete orgs"
ON public.organizations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Tighten Org self update to include WITH CHECK (still requires trigger above for column-level)
DROP POLICY IF EXISTS "Org self update" ON public.organizations;
CREATE POLICY "Org self update"
ON public.organizations FOR UPDATE TO authenticated
USING (id = public.current_org_id())
WITH CHECK (id = public.current_org_id());

-- =========================================================
-- 5. ACTIVITY_EVENTS: explicit UPDATE/DELETE policies
-- =========================================================
-- No user can UPDATE events
CREATE POLICY "Nobody updates events"
ON public.activity_events FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

-- Only admins can DELETE for cleanup
CREATE POLICY "Admins delete events"
ON public.activity_events FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 6. SECURITY DEFINER: revoke is_subscription_active from authenticated
-- (only called server-side via service role; clients never need it)
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.is_subscription_active(UUID) FROM authenticated;