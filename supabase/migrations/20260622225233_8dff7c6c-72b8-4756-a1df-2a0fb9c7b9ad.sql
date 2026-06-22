CREATE TABLE public.plan_pricing (
  plan_id text PRIMARY KEY,
  base_price_ars integer NOT NULL,
  discount_pct integer NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_pricing TO anon, authenticated;
GRANT ALL ON public.plan_pricing TO service_role;

ALTER TABLE public.plan_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plan pricing"
  ON public.plan_pricing FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage plan pricing"
  ON public.plan_pricing FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER plan_pricing_updated_at
  BEFORE UPDATE ON public.plan_pricing
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.plan_pricing (plan_id, base_price_ars, discount_pct) VALUES
  ('free', 0, 0),
  ('starter', 30000, 20),
  ('pro', 60000, 20),
  ('enterprise', 120000, 20),
  ('custom', -1, 0)
ON CONFLICT (plan_id) DO NOTHING;

-- Dedupe existing applications (keep oldest per vacancy+email)
DELETE FROM public.applications a
USING public.applications b
WHERE a.vacancy_id = b.vacancy_id
  AND lower(a.email) = lower(b.email)
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS applications_vacancy_email_uniq
  ON public.applications (vacancy_id, lower(email));