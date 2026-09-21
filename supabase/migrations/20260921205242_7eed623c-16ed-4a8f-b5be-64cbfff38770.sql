ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS cv_limit_override integer;

UPDATE public.organizations
SET plan_price_ars = 48000,
    cv_limit_override = 1000
WHERE id = '4b6d8811-8f84-4db0-a832-0b29709fe84f';

INSERT INTO public.activity_events (org_id, event_type, metadata)
VALUES ('4b6d8811-8f84-4db0-a832-0b29709fe84f', 'admin.set_plan', '{"plan_price_ars":48000,"plan_id":"pro","cv_limit_override":1000,"reason":"upgrade a Pro + 1000 CVs"}'::jsonb);