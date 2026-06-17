
-- Block 2: extend screening_questions with type + options + auto-discard rules
ALTER TABLE public.screening_questions
  ADD COLUMN IF NOT EXISTS qtype TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add a CHECK via trigger (avoid CHECK constraint on enums to keep flexible)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'screening_questions_qtype_check') THEN
    ALTER TABLE public.screening_questions
      ADD CONSTRAINT screening_questions_qtype_check
      CHECK (qtype IN ('text','single','multi'));
  END IF;
END $$;

-- Block 6: anti-abuse identity fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS dni TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Unique indexes to block duplicate free trial accounts (case-insensitive name + birth)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_dni_unique
  ON public.profiles (dni) WHERE dni IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_identity_unique
  ON public.profiles (lower(full_name), birth_date)
  WHERE full_name IS NOT NULL AND birth_date IS NOT NULL;

-- Helper RPC: check if identity already exists (called publicly during signup)
CREATE OR REPLACE FUNCTION public.identity_exists(_dni TEXT, _full_name TEXT, _birth_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE (_dni IS NOT NULL AND dni = _dni)
       OR (_full_name IS NOT NULL AND _birth_date IS NOT NULL
           AND lower(full_name) = lower(_full_name)
           AND birth_date = _birth_date)
  )
$$;

GRANT EXECUTE ON FUNCTION public.identity_exists(TEXT, TEXT, DATE) TO anon, authenticated;
