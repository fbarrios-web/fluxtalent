
CREATE OR REPLACE FUNCTION public.get_public_vacancy_by_slug(_slug text)
 RETURNS TABLE(id uuid, title text, area text, seniority text, modality text, location text, description text, responsibilities text, requirements text, nice_to_have text, status text, org_id uuid, org_name text, screening_questions jsonb)
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
    ) AS screening_questions
  FROM public.vacancies v
  JOIN public.organizations o ON o.id = v.org_id
  WHERE v.public_slug = _slug AND v.status = 'active'
  LIMIT 1
$function$;
