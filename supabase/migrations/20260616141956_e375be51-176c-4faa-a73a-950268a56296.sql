
-- Org branding extras
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS consultancy_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

-- Profiles: per-recruiter Google OAuth
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_email text,
  ADD COLUMN IF NOT EXISTS google_connected_at timestamptz;

-- Per-vacancy scheduling config
CREATE TABLE IF NOT EXISTS public.vacancy_scheduling (
  vacancy_id uuid PRIMARY KEY REFERENCES public.vacancies(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 240),
  instructions text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacancy_scheduling TO authenticated;
GRANT ALL ON public.vacancy_scheduling TO service_role;
ALTER TABLE public.vacancy_scheduling ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage scheduling" ON public.vacancy_scheduling
  FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());
CREATE TRIGGER trg_vsched_updated BEFORE UPDATE ON public.vacancy_scheduling
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Recurring weekly rules
CREATE TABLE IF NOT EXISTS public.availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL CHECK (end_time > start_time),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_rules TO authenticated;
GRANT ALL ON public.availability_rules TO service_role;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage rules" ON public.availability_rules
  FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

-- Concrete slots (open/blocked/booked)
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL CHECK (end_at > start_at),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','blocked','booked')),
  source text NOT NULL DEFAULT 'rule' CHECK (source IN ('rule','manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vacancy_id, start_at)
);
CREATE INDEX IF NOT EXISTS idx_slots_vac_status_time
  ON public.availability_slots(vacancy_id, status, start_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_slots TO authenticated;
GRANT ALL ON public.availability_slots TO service_role;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage slots" ON public.availability_slots
  FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

-- Bookings
CREATE TABLE IF NOT EXISTS public.interview_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  vacancy_id uuid NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('interview_1','interview_2','interview_3')),
  booking_token uuid NOT NULL DEFAULT gen_random_uuid(),
  slot_id uuid REFERENCES public.availability_slots(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  duration_minutes integer,
  meet_link text,
  google_event_id text,
  recruiter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scheduled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_bookings_token ON public.interview_bookings(booking_token);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_bookings TO authenticated;
GRANT ALL ON public.interview_bookings TO service_role;
ALTER TABLE public.interview_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read bookings" ON public.interview_bookings
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "org members write bookings" ON public.interview_bookings
  FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.interview_bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Public RPC: get booking + slots by token (no auth)
CREATE OR REPLACE FUNCTION public.get_booking_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
  LEFT JOIN public.vacancy_scheduling vs ON vs.vacancy_id = ib.vacancy_id
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
         AND s.status = 'open'
         AND s.start_at > now()
         AND s.start_at < now() + interval '30 days'),
      '[]'::jsonb)
  );
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.get_booking_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid) TO anon, authenticated;

-- Atomic slot reservation (returns true if reserved)
CREATE OR REPLACE FUNCTION public.reserve_slot(_token uuid, _slot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.reserve_slot(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_slot(uuid, uuid) TO anon, authenticated;
