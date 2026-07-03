
-- Admin unlimited accounts: flag that grants unlimited quotas without counting as revenue.
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_unlimited boolean NOT NULL DEFAULT false;

-- Extend billing tamper trigger to also allow toggling is_unlimited only by admins
CREATE OR REPLACE FUNCTION public.prevent_org_billing_tamper()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.trial_ends_at      IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.plan_price_ars     IS DISTINCT FROM OLD.plan_price_ars
     OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
     OR NEW.last_payment_at    IS DISTINCT FROM OLD.last_payment_at
     OR NEW.mp_preapproval_id  IS DISTINCT FROM OLD.mp_preapproval_id
     OR NEW.is_unlimited       IS DISTINCT FROM OLD.is_unlimited
  THEN
    RAISE EXCEPTION 'Solo los administradores pueden modificar campos de facturación de la organización.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Full org purge (used by admin panel).
CREATE OR REPLACE FUNCTION public.admin_delete_org(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  DELETE FROM public.email_send_log     WHERE org_id = _org_id;
  DELETE FROM public.email_unsubscribe_tokens WHERE org_id = _org_id;
  DELETE FROM public.suppressed_emails  WHERE org_id = _org_id;
  DELETE FROM public.email_templates    WHERE org_id = _org_id;
  DELETE FROM public.satisfaction_surveys WHERE org_id = _org_id;
  DELETE FROM public.payments           WHERE org_id = _org_id;
  DELETE FROM public.activity_events    WHERE org_id = _org_id;
  DELETE FROM public.invoice_requests   WHERE org_id = _org_id;
  DELETE FROM public.user_roles         WHERE user_id IN (SELECT id FROM public.profiles WHERE org_id = _org_id);
  DELETE FROM public.profiles           WHERE org_id = _org_id;
  DELETE FROM public.organizations      WHERE id = _org_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_delete_org(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_org(uuid) TO authenticated, service_role;
