CREATE OR REPLACE FUNCTION public.get_booking_by_token(_token uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE b record; result jsonb;
BEGIN
  SELECT ib.*, v.title AS vacancy_title, v.public_slug, o.name AS org_name,
         o.consultancy_name, o.brand_color, o.logo_url, o.timezone, o.custom_features,
         a.first_name, a.last_name, a.email AS candidate_email,
         vs.duration_minutes AS cfg_duration, vs.instructions AS candidate_instructions,
         bs.location AS slot_location, bs.location_url AS slot_location_url
  INTO b
  FROM public.interview_bookings ib
  JOIN public.vacancies v ON v.id = ib.vacancy_id
  JOIN public.organizations o ON o.id = ib.org_id
  JOIN public.applications a ON a.id = ib.application_id
  LEFT JOIN public.vacancy_scheduling vs ON vs.vacancy_id = ib.vacancy_id AND vs.stage = ib.stage
  LEFT JOIN public.availability_slots bs ON bs.id = ib.slot_id
  WHERE ib.booking_token = _token LIMIT 1;

  IF b IS NULL THEN RETURN NULL; END IF;

  result := jsonb_build_object(
    'id', b.id, 'status', b.status, 'stage', b.stage, 'scheduled_at', b.scheduled_at,
    'meet_link', b.meet_link,
    'duration_minutes', COALESCE(b.duration_minutes, b.cfg_duration, 30),
    'vacancy_title', b.vacancy_title, 'org_name', b.org_name, 'consultancy_name', b.consultancy_name,
    'brand_color', COALESCE(b.brand_color, '#0F766E'), 'logo_url', b.logo_url,
    'timezone', COALESCE(b.timezone, 'America/Argentina/Buenos_Aires'),
    'in_person', COALESCE((b.custom_features->>'in_person_interviews')::boolean, false),
    'location', b.slot_location, 'location_url', b.slot_location_url,
    'instructions', b.candidate_instructions,
    'first_name', b.first_name, 'last_name', b.last_name, 'candidate_email', b.candidate_email,
    'slots', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'start_at', s.start_at, 'end_at', s.end_at,
          'location', s.location, 'location_url', s.location_url,
          'remaining', s.capacity - s.booked_count, 'capacity', s.capacity) ORDER BY s.start_at)
       FROM public.availability_slots s
       WHERE s.vacancy_id = b.vacancy_id AND s.stage = b.stage AND s.status = 'open'
         AND s.booked_count < s.capacity
         AND s.start_at > now() AND s.start_at < now() + interval '60 days'),
      '[]'::jsonb)
  );
  RETURN result;
END $function$;

REVOKE ALL ON FUNCTION public.get_booking_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid) TO anon, authenticated;