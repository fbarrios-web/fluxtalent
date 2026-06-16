
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org UUID;
BEGIN
  INSERT INTO public.organizations(name, trial_ends_at, subscription_status)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'org_name', 'Mi empresa'), now() + INTERVAL '15 days', 'trialing')
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

-- Grant admin to the new owner if user already exists
INSERT INTO public.user_roles(user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'florenciajulietabarrios@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
