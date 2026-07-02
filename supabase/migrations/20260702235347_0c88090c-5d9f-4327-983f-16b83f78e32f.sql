-- Fix: default plan_price_ars should be 0 so new orgs are eligible for the 15-day Free trial.
ALTER TABLE public.organizations ALTER COLUMN plan_price_ars SET DEFAULT 0;

-- Update handle_new_user to be explicit about Free trial defaults.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org UUID;
BEGIN
  INSERT INTO public.organizations(name, trial_ends_at, subscription_status, plan_price_ars)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'org_name', 'Mi empresa'), now() + INTERVAL '15 days', 'trialing', 0)
  RETURNING id INTO new_org;

  INSERT INTO public.profiles(id, org_id, display_name)
  VALUES (NEW.id, new_org, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  IF lower(NEW.email) = 'florenciajulietabarrios@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'recruiter')
  ON CONFLICT (user_id, role) DO NOTHING;

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
END $function$;

-- Backfill: orgs actualmente en trialing SIN pagos ni preapproval quedaron con el default viejo (20000).
-- Bajarlas a 0 para que puedan usar el trial gratuito sin bloqueos y aparezcan como "Free (trial)" en el admin.
UPDATE public.organizations
   SET plan_price_ars = 0
 WHERE subscription_status = 'trialing'
   AND last_payment_at IS NULL
   AND mp_preapproval_id IS NULL
   AND plan_price_ars > 0;
