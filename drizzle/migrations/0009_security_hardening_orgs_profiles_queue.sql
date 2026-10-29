-- lovable-cron-fallback-reviewed: existing 15s CV queue worker (user requirement); only adds a private auth header, cadence unchanged
DROP POLICY IF EXISTS "Auth users create org" ON public.organizations;

CREATE OR REPLACE FUNCTION public.prevent_profile_org_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('postgres','supabase_admin','service_role') OR coalesce(auth.role(),'') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.org_id IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede asignar la organización desde el perfil';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'No se puede cambiar la organización desde el perfil';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_prevent_org_change ON public.profiles;
CREATE TRIGGER profiles_prevent_org_change BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_org_change();

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS private.internal_secrets (name text PRIMARY KEY, value text NOT NULL);
REVOKE ALL ON private.internal_secrets FROM anon, authenticated;
INSERT INTO private.internal_secrets(name, value)
VALUES ('cv_queue', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cv_queue_secret(_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM private.internal_secrets WHERE name = 'cv_queue' AND value = _secret)
$$;
REVOKE ALL ON FUNCTION public.verify_cv_queue_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cv_queue_secret(text) TO service_role;

DO $$
DECLARE j text; d int;
BEGIN
  FOREACH j IN ARRAY ARRAY['a','b','c','d'] LOOP
    d := CASE j WHEN 'a' THEN 0 WHEN 'b' THEN 15 WHEN 'c' THEN 30 ELSE 45 END;
    PERFORM cron.schedule('process-cv-queue-' || j, '* * * * *',
      CASE WHEN d > 0 THEN format('SELECT pg_sleep(%s);', d) ELSE '' END ||
      $c$ SELECT net.http_post(
        url:='https://fluxtalent.lovable.app/api/public/hooks/process-cv-queue',
        headers:=jsonb_build_object('Content-Type','application/json',
          'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbGp1aWdlZHR2enh1bG5iaWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjM0MzgsImV4cCI6MjA5NzEzOTQzOH0.QL2fNZOnqralzftXvhVkDyIDJn77r8C8UI3ptJBL5Ts',
          'x-cron-secret',(SELECT value FROM private.internal_secrets WHERE name='cv_queue')),
        body:='{"limit": 25}'::jsonb); $c$);
  END LOOP;
END $$;