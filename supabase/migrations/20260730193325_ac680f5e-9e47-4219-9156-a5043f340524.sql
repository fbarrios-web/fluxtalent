ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS grace_until timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_uidx
  ON public.payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_org_billing_tamper()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     OR NEW.grace_until        IS DISTINCT FROM OLD.grace_until
     OR NEW.paddle_subscription_id IS DISTINCT FROM OLD.paddle_subscription_id
     OR NEW.paddle_customer_id IS DISTINCT FROM OLD.paddle_customer_id
     OR NEW.plan_currency      IS DISTINCT FROM OLD.plan_currency
  THEN
    RAISE EXCEPTION 'Solo los administradores pueden modificar campos de facturación de la organización.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.is_subscription_active(_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = _org_id
      AND (
        is_unlimited
        OR (subscription_status = 'trialing' AND trial_ends_at > now())
        OR (subscription_status = 'active' AND (current_period_end IS NULL OR current_period_end > now()))
        OR (subscription_status = 'canceled' AND current_period_end IS NOT NULL AND current_period_end > now())
        OR (subscription_status = 'past_due' AND grace_until IS NOT NULL AND grace_until > now())
      )
  )
$function$;