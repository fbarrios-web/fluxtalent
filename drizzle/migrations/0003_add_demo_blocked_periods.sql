CREATE TABLE public.demo_blocked_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (ends_at > starts_at),
  CHECK (reason IS NULL OR length(reason) <= 300)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_blocked_periods TO authenticated;
GRANT ALL ON public.demo_blocked_periods TO service_role;
ALTER TABLE public.demo_blocked_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage demo blocked periods"
ON public.demo_blocked_periods FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX demo_blocked_periods_time_idx
ON public.demo_blocked_periods (starts_at, ends_at);

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
      WHERE s.status = 'open'
        AND s.start_at > now()
        AND s.start_at < now() + interval '60 days'
        AND NOT EXISTS (
          SELECT 1
          FROM public.demo_blocked_periods b
          WHERE s.start_at < b.ends_at AND b.starts_at < s.end_at
        )
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

  UPDATE public.demo_slots target
  SET status = 'booked'
  WHERE target.id = _slot_id
    AND target.status = 'open'
    AND target.start_at > now()
    AND NOT EXISTS (
      SELECT 1
      FROM public.demo_blocked_periods blocked
      WHERE target.start_at < blocked.ends_at AND blocked.starts_at < target.end_at
    )
  RETURNING target.* INTO s;

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
REVOKE ALL ON FUNCTION public.reserve_demo_slot(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_demo_slot(uuid, text, text, text, text) TO service_role;