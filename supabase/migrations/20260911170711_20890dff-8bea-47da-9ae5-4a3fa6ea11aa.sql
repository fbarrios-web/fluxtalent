ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS promo_plan_id text,
  ADD COLUMN IF NOT EXISTS promo_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_ack_at timestamptz;

CREATE INDEX IF NOT EXISTS organizations_promo_ends_at_idx ON public.organizations (promo_ends_at);