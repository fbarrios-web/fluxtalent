
-- 1. Índices para queries calientes
CREATE INDEX IF NOT EXISTS idx_applications_vacancy_stage
  ON public.applications (vacancy_id, stage);

CREATE INDEX IF NOT EXISTS idx_applications_org_created
  ON public.applications (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_ai_queue
  ON public.applications (ai_status, ai_next_attempt_at)
  WHERE ai_status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_application_events_app_created
  ON public.application_events (application_id, created_at DESC);

-- 2. Reprogramar el worker de CVs
DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN
    SELECT jobid FROM cron.job
    WHERE jobname LIKE 'process-cv-queue%' OR command LIKE '%process-cv-queue%'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'process-cv-queue-a', '* * * * *',
  $CRON$
  SELECT net.http_post(
    url:='https://fluxtalent.lovable.app/api/public/hooks/process-cv-queue',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbGp1aWdlZHR2enh1bG5iaWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjM0MzgsImV4cCI6MjA5NzEzOTQzOH0.QL2fNZOnqralzftXvhVkDyIDJn77r8C8UI3ptJBL5Ts"}'::jsonb,
    body:='{"limit": 25}'::jsonb
  );
  $CRON$
);
SELECT cron.schedule(
  'process-cv-queue-b', '* * * * *',
  $CRON$
  SELECT pg_sleep(15);
  SELECT net.http_post(
    url:='https://fluxtalent.lovable.app/api/public/hooks/process-cv-queue',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbGp1aWdlZHR2enh1bG5iaWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjM0MzgsImV4cCI6MjA5NzEzOTQzOH0.QL2fNZOnqralzftXvhVkDyIDJn77r8C8UI3ptJBL5Ts"}'::jsonb,
    body:='{"limit": 25}'::jsonb
  );
  $CRON$
);
SELECT cron.schedule(
  'process-cv-queue-c', '* * * * *',
  $CRON$
  SELECT pg_sleep(30);
  SELECT net.http_post(
    url:='https://fluxtalent.lovable.app/api/public/hooks/process-cv-queue',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbGp1aWdlZHR2enh1bG5iaWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjM0MzgsImV4cCI6MjA5NzEzOTQzOH0.QL2fNZOnqralzftXvhVkDyIDJn77r8C8UI3ptJBL5Ts"}'::jsonb,
    body:='{"limit": 25}'::jsonb
  );
  $CRON$
);
SELECT cron.schedule(
  'process-cv-queue-d', '* * * * *',
  $CRON$
  SELECT pg_sleep(45);
  SELECT net.http_post(
    url:='https://fluxtalent.lovable.app/api/public/hooks/process-cv-queue',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkbGp1aWdlZHR2enh1bG5iaWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjM0MzgsImV4cCI6MjA5NzEzOTQzOH0.QL2fNZOnqralzftXvhVkDyIDJn77r8C8UI3ptJBL5Ts"}'::jsonb,
    body:='{"limit": 25}'::jsonb
  );
  $CRON$
);
