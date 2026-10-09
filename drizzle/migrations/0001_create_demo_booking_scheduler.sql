CREATE TABLE public.demo_scheduling_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  organizer_id uuid NOT NULL REFERENCES public.profiles(id),
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 240),
  timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_scheduling_config TO authenticated;
GRANT ALL ON public.demo_scheduling_config TO service_role;
ALTER TABLE public.demo_scheduling_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins manage demo scheduling config"
ON public.demo_scheduling_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.demo_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  effective_from date,
  effective_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_availability_rules TO authenticated;
GRANT ALL ON public.demo_availability_rules TO service_role;
ALTER TABLE public.demo_availability_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins manage demo availability rules"
ON public.demo_availability_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.demo_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'booked', 'blocked')),
  source text NOT NULL DEFAULT 'rule' CHECK (source IN ('rule', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (start_at, end_at),
  CHECK (end_at > start_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_slots TO authenticated;
GRANT ALL ON public.demo_slots TO service_role;
ALTER TABLE public.demo_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins manage demo slots"
ON public.demo_slots FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.demo_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL UNIQUE REFERENCES public.demo_slots(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  meet_link text,
  google_event_id text,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'failed', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.demo_bookings TO authenticated;
GRANT ALL ON public.demo_bookings TO service_role;
ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins view and manage demo bookings"
ON public.demo_bookings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_public_demo_slots()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'enabled', COALESCE((SELECT enabled FROM public.demo_scheduling_config WHERE id = true), false),
    'duration_minutes', COALESCE((SELECT duration_minutes FROM public.demo_scheduling_config WHERE id = true), 30),
    'timezone', COALESCE((SELECT timezone FROM public.demo_scheduling_config WHERE id = true), 'America/Argentina/Buenos_Aires'),
    'slots', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'start_at', s.start_at, 'end_at', s.end_at) ORDER BY s.start_at)
      FROM public.demo_slots s
      WHERE s.status = 'open' AND s.start_at > now() AND s.start_at < now() + interval '60 days'
    ), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_public_demo_slots() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_demo_slot(
  _slot_id uuid,
  _first_name text,
  _last_name text,
  _email text,
  _phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.demo_slots%ROWTYPE;
  b public.demo_bookings%ROWTYPE;
BEGIN
  IF length(trim(_first_name)) < 2 OR length(trim(_first_name)) > 100
     OR length(trim(_last_name)) < 2 OR length(trim(_last_name)) > 100
     OR length(trim(_email)) < 5 OR length(trim(_email)) > 255
     OR length(trim(_phone)) < 6 OR length(trim(_phone)) > 50 THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;

  UPDATE public.demo_slots
  SET status = 'booked'
  WHERE id = _slot_id AND status = 'open' AND start_at > now()
  RETURNING * INTO s;

  IF s.id IS NULL THEN
    RAISE EXCEPTION 'El horario ya no está disponible' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.demo_bookings (slot_id, first_name, last_name, email, phone)
  VALUES (s.id, trim(_first_name), trim(_last_name), lower(trim(_email)), trim(_phone))
  RETURNING * INTO b;

  RETURN jsonb_build_object(
    'booking_id', b.id,
    'start_at', s.start_at,
    'end_at', s.end_at,
    'first_name', b.first_name,
    'last_name', b.last_name,
    'email', b.email,
    'phone', b.phone
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reserve_demo_slot(uuid, text, text, text, text) TO anon, authenticated, service_role;

CREATE TRIGGER demo_bookings_touch
BEFORE UPDATE ON public.demo_bookings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();