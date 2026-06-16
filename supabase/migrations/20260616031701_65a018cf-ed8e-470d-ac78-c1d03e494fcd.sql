-- 1. Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- 2. Organizations: subscription fields
ALTER TABLE public.organizations
  ADD COLUMN subscription_status public.subscription_status NOT NULL DEFAULT 'trialing',
  ADD COLUMN trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 days'),
  ADD COLUMN plan_price_ars NUMERIC(12,2) NOT NULL DEFAULT 20000,
  ADD COLUMN mp_preapproval_id TEXT,
  ADD COLUMN current_period_end TIMESTAMPTZ,
  ADD COLUMN last_payment_at TIMESTAMPTZ;

-- 3. user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. has_role (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 5. user_roles policies
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Subscription active helper
CREATE OR REPLACE FUNCTION public.is_subscription_active(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = _org_id
      AND (
        (subscription_status = 'trialing' AND trial_ends_at > now())
        OR (subscription_status = 'active' AND (current_period_end IS NULL OR current_period_end > now()))
      )
  )
$$;

-- 7. Allow admins to read/update any organization
CREATE POLICY "Admins read all orgs" ON public.organizations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all orgs" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Allow admins to read all profiles
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 9. activity_events
CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_org_idx ON public.activity_events(org_id, created_at DESC);
CREATE INDEX activity_events_type_idx ON public.activity_events(event_type, created_at DESC);
GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read own events" ON public.activity_events FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Org members insert own events" ON public.activity_events FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() OR public.has_role(auth.uid(), 'admin'));

-- 10. payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  provider_payment_id TEXT,
  amount_ars NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);
CREATE INDEX payments_org_idx ON public.payments(org_id, created_at DESC);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read own payments" ON public.payments FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.has_role(auth.uid(), 'admin'));

-- 11. Updated handle_new_user (trial + admin auto-grant)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org UUID;
BEGIN
  INSERT INTO public.organizations(name, trial_ends_at, subscription_status)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'org_name', 'Mi empresa'), now() + INTERVAL '15 days', 'trialing')
  RETURNING id INTO new_org;

  INSERT INTO public.profiles(id, org_id, display_name)
  VALUES (NEW.id, new_org, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  -- Auto-grant admin role to platform owner
  IF lower(NEW.email) = 'talent@fluxautomatizaciones.com.ar' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Default recruiter role for everyone
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'recruiter')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Seed default email templates
  INSERT INTO public.email_templates(org_id, key, subject, body) VALUES
    (new_org, 'rejection', 'Actualización sobre tu postulación', 'Hola {{first_name}},

Gracias por postularte a {{vacancy_title}}. En esta oportunidad decidimos avanzar con otros perfiles más alineados a la búsqueda.

Te deseamos mucho éxito.

{{signature}}'),
    (new_org, 'interview_invite', 'Invitación a entrevista — {{vacancy_title}}', 'Hola {{first_name}},

¡Buenas noticias! Queremos avanzar con una entrevista para la posición de {{vacancy_title}}.

{{signature}}'),
    (new_org, 'offer', 'Oferta — {{vacancy_title}}', 'Hola {{first_name}},

Nos complace ofrecerte sumarte como {{vacancy_title}}.

{{signature}}');

  RETURN NEW;
END $$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. Backfill: extend trial for existing orgs that don't have it set in the past
UPDATE public.organizations
SET trial_ends_at = now() + INTERVAL '15 days', subscription_status = 'trialing'
WHERE trial_ends_at < now() AND subscription_status = 'trialing';

-- 13. Backfill: assign recruiter role to existing users without role
INSERT INTO public.user_roles(user_id, role)
SELECT p.id, 'recruiter'::public.app_role FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id)
ON CONFLICT DO NOTHING;