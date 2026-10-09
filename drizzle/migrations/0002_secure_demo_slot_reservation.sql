REVOKE EXECUTE ON FUNCTION public.reserve_demo_slot(uuid, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_demo_slot(uuid, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_demo_slot(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target_slot uuid;
BEGIN
  SELECT slot_id INTO target_slot FROM public.demo_bookings WHERE id = _booking_id;
  IF target_slot IS NULL THEN RETURN; END IF;
  UPDATE public.demo_bookings SET status = 'failed' WHERE id = _booking_id;
  UPDATE public.demo_slots SET status = 'open' WHERE id = target_slot;
END;
$$;
REVOKE ALL ON FUNCTION public.release_demo_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_demo_slot(uuid) TO service_role;