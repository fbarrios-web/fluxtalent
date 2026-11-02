REVOKE EXECUTE ON FUNCTION public.claim_pending_ai_analyses(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_ai_analyses(integer, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserve_slot(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_slot(uuid, uuid) TO service_role;