
-- 1) vacancy_scheduling: stage + new fields
ALTER TABLE public.vacancy_scheduling
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'interview_1',
  ADD COLUMN IF NOT EXISTS interviewer_email text,
  ADD COLUMN IF NOT EXISTS extra_invitees jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.vacancy_scheduling
  DROP CONSTRAINT IF EXISTS vacancy_scheduling_stage_check;
ALTER TABLE public.vacancy_scheduling
  ADD CONSTRAINT vacancy_scheduling_stage_check CHECK (stage IN ('interview_1','interview_2','interview_3'));

ALTER TABLE public.vacancy_scheduling DROP CONSTRAINT vacancy_scheduling_pkey;
ALTER TABLE public.vacancy_scheduling ADD CONSTRAINT vacancy_scheduling_pkey PRIMARY KEY (vacancy_id, stage);

-- 2) availability_rules: stage
ALTER TABLE public.availability_rules
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'interview_1';
ALTER TABLE public.availability_rules
  DROP CONSTRAINT IF EXISTS availability_rules_stage_check;
ALTER TABLE public.availability_rules
  ADD CONSTRAINT availability_rules_stage_check CHECK (stage IN ('interview_1','interview_2','interview_3'));

-- 3) availability_slots: stage + unique per stage
ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'interview_1';
ALTER TABLE public.availability_slots
  DROP CONSTRAINT IF EXISTS availability_slots_stage_check;
ALTER TABLE public.availability_slots
  ADD CONSTRAINT availability_slots_stage_check CHECK (stage IN ('interview_1','interview_2','interview_3'));

ALTER TABLE public.availability_slots DROP CONSTRAINT IF EXISTS availability_slots_vacancy_id_start_at_key;
ALTER TABLE public.availability_slots ADD CONSTRAINT availability_slots_vacancy_stage_start_key UNIQUE (vacancy_id, stage, start_at);

-- 4) reserve_slot: filtrar por etapa
CREATE OR REPLACE FUNCTION public.reserve_slot(_token uuid, _slot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b record;
  s record;
  affected int;
BEGIN
  SELECT * INTO b FROM public.interview_bookings WHERE booking_token = _token LIMIT 1;
  IF b IS NULL THEN
    RAISE EXCEPTION 'Booking inválido' USING ERRCODE = '22023';
  END IF;
  IF b.status = 'scheduled' THEN
    RAISE EXCEPTION 'La entrevista ya fue agendada' USING ERRCODE = '22023';
  END IF;

  UPDATE public.availability_slots
    SET status = 'booked'
  WHERE id = _slot_id
    AND vacancy_id = b.vacancy_id
    AND stage = b.stage
    AND status = 'open'
    AND start_at > now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN
    RAISE EXCEPTION 'El horario ya no está disponible' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO s FROM public.availability_slots WHERE id = _slot_id;

  UPDATE public.interview_bookings
    SET slot_id = _slot_id,
        scheduled_at = s.start_at,
        duration_minutes = EXTRACT(EPOCH FROM (s.end_at - s.start_at))/60
    WHERE id = b.id;

  RETURN jsonb_build_object(
    'booking_id', b.id,
    'application_id', b.application_id,
    'vacancy_id', b.vacancy_id,
    'org_id', b.org_id,
    'stage', b.stage,
    'recruiter_id', b.recruiter_id,
    'start_at', s.start_at,
    'end_at', s.end_at
  );
END $function$;

-- 5) get_booking_by_token: slots por etapa
CREATE OR REPLACE FUNCTION public.get_booking_by_token(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b record;
  result jsonb;
BEGIN
  SELECT ib.*, v.title AS vacancy_title, v.public_slug, o.name AS org_name,
         o.consultancy_name, o.brand_color, o.logo_url, o.timezone,
         a.first_name, a.last_name, a.email AS candidate_email,
         vs.duration_minutes AS cfg_duration
  INTO b
  FROM public.interview_bookings ib
  JOIN public.vacancies v ON v.id = ib.vacancy_id
  JOIN public.organizations o ON o.id = ib.org_id
  JOIN public.applications a ON a.id = ib.application_id
  LEFT JOIN public.vacancy_scheduling vs
    ON vs.vacancy_id = ib.vacancy_id AND vs.stage = ib.stage
  WHERE ib.booking_token = _token
  LIMIT 1;

  IF b IS NULL THEN
    RETURN NULL;
  END IF;

  result := jsonb_build_object(
    'id', b.id,
    'status', b.status,
    'stage', b.stage,
    'scheduled_at', b.scheduled_at,
    'meet_link', b.meet_link,
    'duration_minutes', COALESCE(b.duration_minutes, b.cfg_duration, 30),
    'vacancy_title', b.vacancy_title,
    'org_name', b.org_name,
    'consultancy_name', b.consultancy_name,
    'brand_color', COALESCE(b.brand_color, '#0F766E'),
    'logo_url', b.logo_url,
    'timezone', COALESCE(b.timezone, 'America/Argentina/Buenos_Aires'),
    'first_name', b.first_name,
    'last_name', b.last_name,
    'candidate_email', b.candidate_email,
    'slots', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'start_at', s.start_at, 'end_at', s.end_at) ORDER BY s.start_at)
       FROM public.availability_slots s
       WHERE s.vacancy_id = b.vacancy_id
         AND s.stage = b.stage
         AND s.status = 'open'
         AND s.start_at > now()
         AND s.start_at < now() + interval '30 days'),
      '[]'::jsonb)
  );
  RETURN result;
END $function$;
