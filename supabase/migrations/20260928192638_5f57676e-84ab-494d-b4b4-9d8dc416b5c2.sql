ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subdomain text,
  ADD COLUMN IF NOT EXISTS custom_features jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sensitive_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_subdomain_key ON public.organizations (subdomain) WHERE subdomain IS NOT NULL;

ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS sensitive_field_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS public_host text;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS sensitive_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP FUNCTION IF EXISTS public.get_public_vacancy_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_public_vacancy_by_slug(_slug text)
 RETURNS TABLE(id uuid, title text, area text, seniority text, modality text, location text, work_schedule text, description text, responsibilities text, requirements text, nice_to_have text, status text, org_id uuid, org_name text, screening_questions jsonb, org_subdomain text, org_logo_url text, org_brand_color text, sensitive_fields jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    v.id,
    v.title,
    v.area,
    v.seniority::text,
    v.modality::text,
    v.location,
    v.work_schedule,
    v.description,
    v.responsibilities,
    v.requirements,
    v.nice_to_have,
    v.status::text,
    v.org_id,
    o.name AS org_name,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'id', q.id, 'question', q.question, 'required', q.required,
          'position', q.position, 'qtype', q.qtype, 'options', q.options
        ) ORDER BY q.position)
       FROM public.screening_questions q WHERE q.vacancy_id = v.id),
      '[]'::jsonb
    ) AS screening_questions,
    o.subdomain AS org_subdomain,
    o.logo_url AS org_logo_url,
    o.brand_color AS org_brand_color,
    CASE
      WHEN COALESCE(o.custom_features->>'sensitive_fields', 'false') = 'true' THEN
        COALESCE(
          (SELECT jsonb_agg(f ORDER BY (f->>'position')::int)
           FROM jsonb_array_elements(o.sensitive_fields) f
           WHERE v.sensitive_field_ids @> to_jsonb(f->>'id')),
          '[]'::jsonb
        )
      ELSE '[]'::jsonb
    END AS sensitive_fields
  FROM public.vacancies v
  JOIN public.organizations o ON o.id = v.org_id
  WHERE v.public_slug = _slug AND v.status = 'active'
  LIMIT 1
$function$