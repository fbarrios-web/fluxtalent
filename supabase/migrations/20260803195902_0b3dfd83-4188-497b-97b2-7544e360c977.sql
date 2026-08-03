-- Explicit write policies scoped to the org (replaces the broad ALL policy)
DROP POLICY IF EXISTS "org members write bookings" ON public.interview_bookings;

CREATE POLICY "org members insert bookings" ON public.interview_bookings
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "org members update bookings" ON public.interview_bookings
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "org members delete bookings" ON public.interview_bookings
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id());

-- Column-level hardening: booking_token is a public, unauthenticated access
-- credential and must not be readable by regular org members.
REVOKE SELECT ON public.interview_bookings FROM authenticated;
GRANT SELECT (
  id, application_id, vacancy_id, org_id, stage, slot_id, scheduled_at,
  duration_minutes, meet_link, google_event_id, recruiter_id, status,
  created_at, updated_at
) ON public.interview_bookings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.interview_bookings TO authenticated;
GRANT ALL ON public.interview_bookings TO service_role;