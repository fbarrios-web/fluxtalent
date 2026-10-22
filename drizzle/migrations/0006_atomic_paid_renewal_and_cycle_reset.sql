CREATE OR REPLACE FUNCTION public.reset_paid_usage_cycle() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.subscription_status = 'active' AND NEW.current_period_end IS NOT NULL
     AND (OLD.current_period_end IS NULL OR NEW.current_period_end > OLD.current_period_end)
  THEN
    NEW.usage_cycle_start := CASE
      WHEN NEW.last_payment_at IS NOT NULL AND NEW.last_payment_at IS DISTINCT FROM OLD.last_payment_at
      THEN NEW.last_payment_at
      ELSE NEW.current_period_end - interval '30 days'
    END;
    NEW.grace_until := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zzz_reset_paid_usage_cycle BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.reset_paid_usage_cycle();
CREATE OR REPLACE FUNCTION public.apply_verified_payment(_org_id uuid, _provider text, _payment_id text, _amount numeric, _paid_at timestamptz, _price numeric DEFAULT NULL, _preapproval_id text DEFAULT NULL, _next_payment_date timestamptz DEFAULT NULL, _raw jsonb DEFAULT NULL, _currency text DEFAULT 'ars') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.organizations%ROWTYPE; p public.payments%ROWTYPE; period_end timestamptz; paid_at timestamptz := coalesce(_paid_at, now());
BEGIN
  IF _provider NOT IN ('mercadopago', 'paypal') OR nullif(_payment_id, '') IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid verified payment'; END IF;
  SELECT * INTO o FROM public.organizations WHERE id = _org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found'; END IF;
  SELECT * INTO p FROM public.payments WHERE provider = _provider AND provider_payment_id = _payment_id;
  IF FOUND AND p.org_id <> _org_id THEN RAISE EXCEPTION 'Payment belongs to another organization'; END IF;
  IF FOUND AND p.status = 'approved' THEN RETURN jsonb_build_object('periodEnd', o.current_period_end, 'previousStatus', o.subscription_status, 'duplicate', true); END IF;
  period_end := coalesce(_next_payment_date, greatest(coalesce(o.current_period_end, paid_at), paid_at) + interval '30 days');
  IF period_end <= paid_at THEN RAISE EXCEPTION 'Invalid payment period'; END IF;
  INSERT INTO public.payments(org_id,provider,provider_payment_id,amount_ars,currency,status,paid_at,raw)
  VALUES (_org_id,_provider,_payment_id,_amount,_currency,'approved',paid_at,_raw)
  ON CONFLICT(provider,provider_payment_id) DO UPDATE SET status='approved',paid_at=EXCLUDED.paid_at,raw=EXCLUDED.raw,amount_ars=EXCLUDED.amount_ars,currency=EXCLUDED.currency;
  UPDATE public.organizations SET subscription_status='active',current_period_end=period_end,last_payment_at=paid_at,grace_until=NULL,usage_cycle_start=paid_at,
    plan_currency=_currency,plan_price_ars=coalesce(_price,plan_price_ars),mp_preapproval_id=coalesce(_preapproval_id,mp_preapproval_id)
  WHERE id=_org_id;
  INSERT INTO public.activity_events(org_id,event_type,metadata) VALUES (_org_id,'subscription.payment_applied',jsonb_build_object('provider',_provider,'payment_id',_payment_id,'period_end',period_end,'previous_status',o.subscription_status));
  RETURN jsonb_build_object('periodEnd',period_end,'previousStatus',o.subscription_status,'duplicate',false);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_verified_payment(uuid,text,text,numeric,timestamptz,numeric,text,timestamptz,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_payment(uuid,text,text,numeric,timestamptz,numeric,text,timestamptz,jsonb,text) TO service_role;