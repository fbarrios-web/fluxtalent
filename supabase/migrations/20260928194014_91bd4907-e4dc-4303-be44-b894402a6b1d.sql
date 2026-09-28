CREATE TABLE public.org_member_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  all_vacancies boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.org_member_access TO authenticated;
GRANT ALL ON public.org_member_access TO service_role;
ALTER TABLE public.org_member_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read access rows" ON public.org_member_access FOR SELECT TO authenticated
USING (user_id = auth.uid() OR org_id = public.current_org_id());

-- true when the user has full access (no row, or all_vacancies) or is assigned to the vacancy
CREATE OR REPLACE FUNCTION public.can_access_vacancy(_vacancy_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM org_member_access a WHERE a.user_id = auth.uid() AND a.all_vacancies = false
  ) OR EXISTS (
    SELECT 1 FROM vacancy_assignees va WHERE va.vacancy_id = _vacancy_id AND va.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_restricted_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM org_member_access a WHERE a.user_id = auth.uid() AND a.all_vacancies = false)
$$;

DROP POLICY "Org vacancies" ON public.vacancies;
CREATE POLICY "Org vacancies read" ON public.vacancies FOR SELECT TO authenticated
  USING (org_id = current_org_id() AND can_access_vacancy(id));
CREATE POLICY "Org vacancies insert" ON public.vacancies FOR INSERT TO authenticated
  WITH CHECK (org_id = current_org_id());
CREATE POLICY "Org vacancies update" ON public.vacancies FOR UPDATE TO authenticated
  USING (org_id = current_org_id() AND can_access_vacancy(id)) WITH CHECK (org_id = current_org_id());
CREATE POLICY "Org vacancies delete" ON public.vacancies FOR DELETE TO authenticated
  USING (org_id = current_org_id() AND NOT is_restricted_member());

DROP POLICY "Org applications" ON public.applications;
CREATE POLICY "Org applications" ON public.applications FOR ALL TO authenticated
  USING (org_id = current_org_id() AND can_access_vacancy(vacancy_id))
  WITH CHECK (org_id = current_org_id() AND can_access_vacancy(vacancy_id));

-- Restricted users that create a vacancy get auto-assigned so they can see it
CREATE OR REPLACE FUNCTION public.auto_assign_restricted_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM org_member_access WHERE user_id = auth.uid() AND all_vacancies = false) THEN
    INSERT INTO vacancy_assignees (vacancy_id, user_id) VALUES (NEW.id, auth.uid()) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_auto_assign_restricted_creator BEFORE INSERT ON public.vacancies
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_restricted_creator();