ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS usage_cycle_start timestamp with time zone;

COMMENT ON COLUMN public.organizations.usage_cycle_start IS 'Inicio del ciclo de consumo (CVs/vacantes) cuando difiere del período de facturación, p.ej. tras un cambio de plan a mitad de mes.';

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
     OR NEW.usage_cycle_start  IS DISTINCT FROM OLD.usage_cycle_start
  THEN
    RAISE EXCEPTION 'Solo los administradores pueden modificar campos de facturación de la organización.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;