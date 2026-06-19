
CREATE TABLE public.invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  invoice_type TEXT NOT NULL DEFAULT 'C',
  business_name TEXT NOT NULL,
  cuit_or_dni TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  amount_ars NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.invoice_requests TO authenticated;
GRANT ALL ON public.invoice_requests TO service_role;

ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their invoice requests"
  ON public.invoice_requests FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can create invoice requests"
  ON public.invoice_requests FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY "Admins can update invoice requests"
  ON public.invoice_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER invoice_requests_touch BEFORE UPDATE ON public.invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
