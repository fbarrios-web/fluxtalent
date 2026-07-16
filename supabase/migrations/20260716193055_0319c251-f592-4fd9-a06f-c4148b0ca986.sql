ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS microsoft_refresh_token text,
  ADD COLUMN IF NOT EXISTS microsoft_email text,
  ADD COLUMN IF NOT EXISTS microsoft_connected_at timestamptz;