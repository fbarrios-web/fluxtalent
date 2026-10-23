CREATE TABLE public.crm_clients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL, company text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
 stage text NOT NULL DEFAULT 'prospect' CHECK (stage IN ('prospect','contacted','proposal','client','paused','lost')),
 owner_name text NOT NULL DEFAULT '', summary text NOT NULL DEFAULT '', source text NOT NULL DEFAULT 'manual',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_clients TO authenticated;
GRANT ALL ON public.crm_clients TO service_role;
ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_clients_admin ON public.crm_clients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX crm_clients_email_unique ON public.crm_clients (lower(trim(email))) WHERE trim(email) <> '';
CREATE TABLE public.crm_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('note','meeting','transcript','event','task')),
 title text NOT NULL, content text NOT NULL DEFAULT '', occurs_at timestamptz,
 due_date date, completed_at timestamptz, responsible text NOT NULL DEFAULT '',
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_records TO authenticated;
GRANT ALL ON public.crm_records TO service_role;
ALTER TABLE public.crm_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_records_admin ON public.crm_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX crm_records_client ON public.crm_records(client_id, created_at DESC);
ALTER TABLE public.demo_bookings ADD COLUMN crm_client_id uuid REFERENCES public.crm_clients(id);
CREATE INDEX demo_bookings_crm_client ON public.demo_bookings(crm_client_id);
INSERT INTO public.crm_clients(name, email, phone, source, created_at)
SELECT DISTINCT ON (lower(trim(email))) trim(first_name || ' ' || last_name), lower(trim(email)), phone, 'demo', created_at
FROM public.demo_bookings ORDER BY lower(trim(email)), created_at;
UPDATE public.demo_bookings b SET crm_client_id = c.id FROM public.crm_clients c WHERE lower(trim(b.email)) = lower(trim(c.email));
CREATE FUNCTION public.link_demo_crm_client() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE linked_id uuid;
BEGIN
 INSERT INTO public.crm_clients(name, email, phone, source) VALUES (trim(NEW.first_name || ' ' || NEW.last_name), lower(trim(NEW.email)), NEW.phone, 'demo') ON CONFLICT DO NOTHING;
 SELECT id INTO linked_id FROM public.crm_clients WHERE lower(trim(email)) = lower(trim(NEW.email));
 NEW.crm_client_id := linked_id;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.link_demo_crm_client() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER demo_booking_crm_link BEFORE INSERT OR UPDATE OF email ON public.demo_bookings FOR EACH ROW EXECUTE FUNCTION public.link_demo_crm_client();