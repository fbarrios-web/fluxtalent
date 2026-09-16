CREATE TABLE public.web_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  landing_path text,
  referrer text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  device_type text,
  os text,
  browser text,
  country text,
  language text,
  page_views integer not null default 0,
  signed_up boolean not null default false,
  user_id uuid
);

CREATE TABLE public.web_events (
  id uuid primary key default gen_random_uuid(),
  session_key text not null,
  event_type text not null,
  path text,
  name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

CREATE INDEX web_sessions_first_seen_idx ON public.web_sessions (first_seen DESC);
CREATE INDEX web_events_created_at_idx ON public.web_events (created_at DESC);
CREATE INDEX web_events_session_idx ON public.web_events (session_key);

GRANT ALL ON public.web_sessions TO service_role;
GRANT ALL ON public.web_events TO service_role;

ALTER TABLE public.web_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_events ENABLE ROW LEVEL SECURITY;