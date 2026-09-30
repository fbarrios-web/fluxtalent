ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS booked_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS location_url text;

UPDATE public.availability_slots SET booked_count = 1 WHERE status = 'booked' AND booked_count = 0;

CREATE OR REPLACE FUNCTION public.reserve_slot(_token uuid, _slot_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE b record; s record; affected int;
BEGIN
  SELECT * INTO b FROM public.interview_bookings WHERE booking_token = _token LIMIT 1;
  IF b IS NULL THEN RAISE EXCEPTION 'Booking inválido' USING ERRCODE = '22023'; END IF;
  IF b.status = 'scheduled' THEN RAISE EXCEPTION 'La entrevista ya fue agendada' USING ERRCODE = '22023'; END IF;

  UPDATE public.availability_slots
    SET booked_count = booked_count + 1,
        status = CASE WHEN booked_count + 1 >= capacity THEN 'booked' ELSE 'open' END
  WHERE id = _slot_id AND vacancy_id = b.vacancy_id AND stage = b.stage
    AND status = 'open' AND booked_count < capacity AND start_at > now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN RAISE EXCEPTION 'El horario ya no está disponible' USING ERRCODE = '22023'; END IF;

  SELECT * INTO s FROM public.availability_slots WHERE id = _slot_id;
  UPDATE public.interview_bookings
    SET slot_id = _slot_id, scheduled_at = s.start_at,
        duration_minutes = EXTRACT(EPOCH FROM (s.end_at - s.start_at))/60
    WHERE id = b.id;

  RETURN jsonb_build_object('booking_id', b.id, 'application_id', b.application_id, 'vacancy_id', b.vacancy_id,
    'org_id', b.org_id, 'stage', b.stage, 'recruiter_id', b.recruiter_id, 'start_at', s.start_at, 'end_at', s.end_at,
    'location', s.location, 'location_url', s.location_url, 'capacity', s.capacity);
END $function$;

CREATE OR REPLACE FUNCTION public.release_slot(_slot_id uuid)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE public.availability_slots
    SET booked_count = GREATEST(booked_count - 1, 0), status = 'open'
  WHERE id = _slot_id;
$$;
REVOKE ALL ON FUNCTION public.release_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_slot(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_booking_by_token(_token uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE b record; result jsonb;
BEGIN
  SELECT ib.*, v.title AS vacancy_title, v.public_slug, o.name AS org_name,
         o.consultancy_name, o.brand_color, o.logo_url, o.timezone, o.custom_features,
         a.first_name, a.last_name, a.email AS candidate_email,
         vs.duration_minutes AS cfg_duration,
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

UPDATE public.organizations
  SET custom_features = custom_features || '{"in_person_interviews": true}'::jsonb
  WHERE subdomain = 'freddo';