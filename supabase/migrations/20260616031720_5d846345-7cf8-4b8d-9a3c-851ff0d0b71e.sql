-- Lock down SECURITY DEFINER functions: revoke from anon
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_subscription_active(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_subscription_active(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_org_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;