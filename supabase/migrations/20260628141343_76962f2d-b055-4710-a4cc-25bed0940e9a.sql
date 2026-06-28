
-- 1) Country/province on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS province text;

-- 2) Satisfaction surveys
CREATE TABLE IF NOT EXISTS public.satisfaction_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  bucket smallint NOT NULL,
  nps smallint NOT NULL,
  comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bucket)
);

GRANT SELECT, INSERT ON public.satisfaction_surveys TO authenticated;
GRANT ALL ON public.satisfaction_surveys TO service_role;
ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own survey"
  ON public.satisfaction_surveys FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND nps BETWEEN 0 AND 10 AND bucket IN (10,30,50));

CREATE POLICY "users read own surveys"
  ON public.satisfaction_surveys FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all surveys"
  ON public.satisfaction_surveys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
