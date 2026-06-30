ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz;
-- Mark existing users whose profile data is complete as having completed setup, to avoid forcing them back through onboarding.
UPDATE public.profiles SET setup_completed_at = COALESCE(setup_completed_at, now())
 WHERE setup_completed_at IS NULL
   AND full_name IS NOT NULL AND dni IS NOT NULL AND birth_date IS NOT NULL
   AND country IS NOT NULL AND province IS NOT NULL;