
-- Enums
CREATE TYPE public.vacancy_status AS ENUM ('draft','active','paused','closed');
CREATE TYPE public.pipeline_stage AS ENUM ('received','shortlisted','interview_1','interview_2','interview_3','offer','hired','rejected');
CREATE TYPE public.seniority AS ENUM ('intern','junior','mid','senior','lead','manager','director');
CREATE TYPE public.modality AS ENUM ('remote','hybrid','onsite');

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#0F766E',
  signature_html TEXT,
  sender_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Org members read profiles" ON public.profiles FOR SELECT TO authenticated USING (
  org_id IS NOT NULL AND org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
);

-- helper to get current user's org without recursion
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE POLICY "Org self read" ON public.organizations FOR SELECT TO authenticated USING (id = public.current_org_id());
CREATE POLICY "Org self update" ON public.organizations FOR UPDATE TO authenticated USING (id = public.current_org_id());
CREATE POLICY "Auth users create org" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);

-- Auto-create profile + org on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org UUID;
BEGIN
  INSERT INTO public.organizations(name) VALUES (COALESCE(NEW.raw_user_meta_data->>'org_name', 'Mi empresa'))
  RETURNING id INTO new_org;
  INSERT INTO public.profiles(id, org_id, display_name)
  VALUES (NEW.id, new_org, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  -- seed default email templates
  INSERT INTO public.email_templates(org_id, key, subject, body) VALUES
    (new_org, 'rejection', 'Actualización sobre tu postulación', 'Hola {{first_name}},\n\nGracias por postularte a {{vacancy_title}}. En esta oportunidad decidimos avanzar con otros perfiles más alineados a la búsqueda.\n\nTe deseamos mucho éxito.\n\n{{signature}}'),
    (new_org, 'interview_invite', 'Invitación a entrevista — {{vacancy_title}}', 'Hola {{first_name}},\n\n¡Buenas noticias! Queremos avanzar con una entrevista para la posición de {{vacancy_title}}.\n\n{{signature}}'),
    (new_org, 'offer', 'Oferta — {{vacancy_title}}', 'Hola {{first_name}},\n\nNos complace ofrecerte sumarte como {{vacancy_title}}.\n\n{{signature}}');
  RETURN NEW;
END $$;

-- Email templates
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org templates" ON public.email_templates FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Vacancies
CREATE TABLE public.vacancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  area TEXT,
  seniority public.seniority,
  modality public.modality,
  location TEXT,
  description TEXT,
  responsibilities TEXT,
  requirements TEXT,
  nice_to_have TEXT,
  competencies TEXT[],
  min_match INT NOT NULL DEFAULT 60,
  status public.vacancy_status NOT NULL DEFAULT 'draft',
  public_slug TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6),'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacancies TO authenticated;
GRANT SELECT ON public.vacancies TO anon;
GRANT ALL ON public.vacancies TO service_role;
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org vacancies" ON public.vacancies FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "Public active vacancies by slug" ON public.vacancies FOR SELECT TO anon
  USING (status = 'active');

-- Screening questions
CREATE TABLE public.screening_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screening_questions TO authenticated;
GRANT SELECT ON public.screening_questions TO anon;
GRANT ALL ON public.screening_questions TO service_role;
ALTER TABLE public.screening_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org screening" ON public.screening_questions FOR ALL TO authenticated
  USING (vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = public.current_org_id()))
  WITH CHECK (vacancy_id IN (SELECT id FROM public.vacancies WHERE org_id = public.current_org_id()));
CREATE POLICY "Public read screening" ON public.screening_questions FOR SELECT TO anon
  USING (vacancy_id IN (SELECT id FROM public.vacancies WHERE status = 'active'));

-- Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  linkedin TEXT,
  cv_url TEXT,
  cv_text TEXT,
  parsed_data JSONB,
  screening_answers JSONB,
  stage public.pipeline_stage NOT NULL DEFAULT 'received',
  match_score INT,
  match_breakdown JSONB,
  ai_summary TEXT,
  strengths TEXT[],
  gaps TEXT[],
  red_flags TEXT[],
  ai_status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'public_form',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org applications" ON public.applications FOR ALL TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());
CREATE INDEX applications_vacancy_idx ON public.applications(vacancy_id);
CREATE INDEX applications_stage_idx ON public.applications(stage);

-- Application events (audit)
CREATE TABLE public.application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.application_events TO authenticated;
GRANT ALL ON public.application_events TO service_role;
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org app events" ON public.application_events FOR ALL TO authenticated
  USING (application_id IN (SELECT id FROM public.applications WHERE org_id = public.current_org_id()))
  WITH CHECK (application_id IN (SELECT id FROM public.applications WHERE org_id = public.current_org_id()));

-- Scorecards
CREATE TABLE public.scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  interviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stage public.pipeline_stage NOT NULL,
  ratings JSONB NOT NULL,
  overall INT,
  recommendation TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scorecards TO authenticated;
GRANT ALL ON public.scorecards TO service_role;
ALTER TABLE public.scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org scorecards" ON public.scorecards FOR ALL TO authenticated
  USING (application_id IN (SELECT id FROM public.applications WHERE org_id = public.current_org_id()))
  WITH CHECK (application_id IN (SELECT id FROM public.applications WHERE org_id = public.current_org_id()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER vacancies_touch BEFORE UPDATE ON public.vacancies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER applications_touch BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
