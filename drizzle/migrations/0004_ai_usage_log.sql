CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  feature text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read ai usage" ON public.ai_usage_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ai_usage_log_org_created_idx ON public.ai_usage_log (org_id, created_at);