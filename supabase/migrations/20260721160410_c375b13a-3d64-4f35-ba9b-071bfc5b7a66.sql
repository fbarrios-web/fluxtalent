-- Fix admin_delete_org: remove references to columns that don't exist on
-- email_send_log / email_unsubscribe_tokens / suppressed_emails (no org_id there).
-- Add organizations.archived_at so admins can archive canceled orgs and hide them from metrics.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_delete_org(_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.application_events WHERE application_id IN (SELECT id FROM public.applications WHERE org_id = _org_id);
  DELETE FROM public.scorecards         WHERE application_id IN (SELECT id FROM public.applications WHERE org_id = _org_id);
  DELETE FROM public.interview_bookings WHERE org_id = _org_id;
  DELETE FROM public.availability_slots WHERE vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = _org_id);
  DELETE FROM public.availability_rules WHERE vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = _org_id);
  DELETE FROM public.vacancy_scheduling WHERE vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = _org_id);
  DELETE FROM public.screening_questions WHERE vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = _org_id);
  DELETE FROM public.vacancy_assignees  WHERE vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = _org_id);
  DELETE FROM public.applications       WHERE org_id = _org_id;
  DELETE FROM public.vacancies          WHERE org_id = _org_id;
  DELETE FROM public.email_templates    WHERE org_id = _org_id;
  DELETE FROM public.satisfaction_surveys WHERE org_id = _org_id;
  DELETE FROM public.payments           WHERE org_id = _org_id;
  DELETE FROM public.activity_events    WHERE org_id = _org_id;
  DELETE FROM public.invoice_requests   WHERE org_id = _org_id;
  DELETE FROM public.subscriptions      WHERE org_id = _org_id;
  DELETE FROM public.user_roles         WHERE user_id IN (SELECT id FROM public.profiles WHERE org_id = _org_id);
  DELETE FROM public.profiles           WHERE org_id = _org_id;
  DELETE FROM public.organizations      WHERE id = _org_id;
END $function$;