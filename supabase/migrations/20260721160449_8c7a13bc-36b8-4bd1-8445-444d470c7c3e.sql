DO $$
DECLARE
  emails text[] := ARRAY[
    'florenciab111@gmail.com','florenciajulietabarrios@gmail.com','fbarrios.roca@gmail.com',
    'teovassallo18@gmail.com','nicolaspalaciios45@gmail.com','reclutamientoia@fluxautomatizaciones.com',
    'clasessubidasroca@gmail.com','florenciab111@hotmail.com','servidor.hvirtual@gmail.com',
    'mcomincini@iua.edu.ar','fbarrios.hvirtual@gmail.com'
  ];
  r record;
  org_ids uuid[];
  o uuid;
BEGIN
  -- Collect target user ids
  FOR r IN SELECT u.id, p.org_id FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
           WHERE lower(u.email) = ANY(SELECT lower(e) FROM unnest(emails) e)
  LOOP
    IF r.org_id IS NOT NULL THEN
      org_ids := array_append(org_ids, r.org_id);
    END IF;
  END LOOP;

  -- Purge each org (dedup)
  IF org_ids IS NOT NULL THEN
    FOREACH o IN ARRAY (SELECT ARRAY(SELECT DISTINCT unnest(org_ids)))
    LOOP
      DELETE FROM public.application_events WHERE application_id IN (SELECT id FROM public.applications WHERE org_id = o);
      DELETE FROM public.scorecards         WHERE application_id IN (SELECT id FROM public.applications WHERE org_id = o);
      DELETE FROM public.interview_bookings WHERE org_id = o;
      DELETE FROM public.availability_slots WHERE vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = o);
      DELETE FROM public.availability_rules WHERE vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = o);
      DELETE FROM public.vacancy_scheduling WHERE vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = o);
      DELETE FROM public.screening_questions WHERE vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = o);
      DELETE FROM public.vacancy_assignees  WHERE vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = o);
      DELETE FROM public.applications       WHERE org_id = o;
      DELETE FROM public.vacancies          WHERE org_id = o;
      DELETE FROM public.email_templates    WHERE org_id = o;
      DELETE FROM public.satisfaction_surveys WHERE org_id = o;
      DELETE FROM public.payments           WHERE org_id = o;
      DELETE FROM public.activity_events    WHERE org_id = o;
      DELETE FROM public.invoice_requests   WHERE org_id = o;
      DELETE FROM public.subscriptions      WHERE org_id = o;
      DELETE FROM public.user_roles         WHERE user_id IN (SELECT id FROM public.profiles WHERE org_id = o);
      DELETE FROM public.profiles           WHERE org_id = o;
      DELETE FROM public.organizations      WHERE id = o;
    END LOOP;
  END IF;

  -- Finally, delete auth users by email (cascade removes any leftover profile).
  DELETE FROM auth.users WHERE lower(email) = ANY(SELECT lower(e) FROM unnest(emails) e);
END $$;