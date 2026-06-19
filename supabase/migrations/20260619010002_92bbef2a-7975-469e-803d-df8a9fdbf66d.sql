
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS organizations_parent_org_id_idx ON public.organizations(parent_org_id);

-- helper: returns the root org id (self if no parent)
CREATE OR REPLACE FUNCTION public.root_org_id(_org_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(o.parent_org_id, o.id) FROM public.organizations o WHERE o.id = _org_id
$$;

-- per-vacancy assignment table for fine-grained access control
CREATE TABLE IF NOT EXISTS public.vacancy_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vacancy_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.vacancy_assignees TO authenticated;
GRANT ALL ON public.vacancy_assignees TO service_role;

ALTER TABLE public.vacancy_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members of root org can view vacancy assignees"
  ON public.vacancy_assignees FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vacancies v
      WHERE v.id = vacancy_id
        AND public.root_org_id(v.org_id) = public.root_org_id(public.current_org_id())
    )
  );

CREATE POLICY "Members of root org can manage vacancy assignees"
  ON public.vacancy_assignees FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vacancies v
      WHERE v.id = vacancy_id
        AND public.root_org_id(v.org_id) = public.root_org_id(public.current_org_id())
    )
  );

CREATE POLICY "Members of root org can remove vacancy assignees"
  ON public.vacancy_assignees FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vacancies v
      WHERE v.id = vacancy_id
        AND public.root_org_id(v.org_id) = public.root_org_id(public.current_org_id())
    )
  );
