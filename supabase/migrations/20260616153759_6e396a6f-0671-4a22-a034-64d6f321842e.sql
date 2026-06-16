
-- 1) Drop redundant anon SELECT on screening_questions (public access goes through RPC)
DROP POLICY IF EXISTS "Public read screening" ON public.screening_questions;

-- 2) Lock down billing column writes at the privilege layer (defense in depth on top of trigger)
REVOKE UPDATE (subscription_status, trial_ends_at, plan_price_ars, current_period_end, last_payment_at, mp_preapproval_id) ON public.organizations FROM authenticated;

-- 3) Restrict reserve_slot to service_role only (server-side route uses service role)
REVOKE EXECUTE ON FUNCTION public.reserve_slot(uuid, uuid) FROM PUBLIC, anon, authenticated;
