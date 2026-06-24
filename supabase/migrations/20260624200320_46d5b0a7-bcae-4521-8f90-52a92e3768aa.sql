
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ai_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_last_error text,
  ADD COLUMN IF NOT EXISTS ai_next_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_applications_ai_queue
  ON public.applications (ai_status, ai_next_attempt_at)
  WHERE ai_status IN ('pending', 'running');

-- Atomically claim up to N pending applications for processing.
-- Returns the claimed rows so a single worker invocation owns them.
CREATE OR REPLACE FUNCTION public.claim_pending_ai_analyses(_limit int DEFAULT 5, _stale_seconds int DEFAULT 180)
RETURNS TABLE(application_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT a.id
    FROM public.applications a
    WHERE a.cv_url IS NOT NULL
      AND (
        (a.ai_status = 'pending'
          AND (a.ai_next_attempt_at IS NULL OR a.ai_next_attempt_at <= now())
          AND COALESCE(a.ai_attempts, 0) < 5)
        OR (a.ai_status = 'running' AND a.updated_at < now() - make_interval(secs => _stale_seconds))
      )
    ORDER BY a.created_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.applications a
    SET ai_status = 'running',
        ai_attempts = COALESCE(a.ai_attempts, 0) + 1,
        updated_at = now()
  FROM cte
  WHERE a.id = cte.id
  RETURNING a.id;
END
$$;

REVOKE ALL ON FUNCTION public.claim_pending_ai_analyses(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_ai_analyses(int, int) TO service_role;
