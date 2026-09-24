ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'read' AFTER 'received';

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS recruiter_notes text;

COMMENT ON COLUMN public.applications.recruiter_notes IS 'Private recruiter notes and observations about the application.';