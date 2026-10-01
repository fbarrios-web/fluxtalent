CREATE OR REPLACE FUNCTION public.get_public_vacancies_board(_subdomain text)
RETURNS TABLE(org_name text, org_logo_url text, org_brand_color text, vacancies jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    o.name AS org_name,
    o.logo_url AS org_logo_url,
    o.brand_color AS org_brand_color,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'id', v.id,
          'title', v.title,
          'area', v.area,
          'seniority', v.seniority::text,
          'modality', v.modality::text,
          'location', v.location,
          'description', left(COALESCE(v.description, ''), 400),
          'public_slug', v.public_slug,
          'public_host', v.public_host
        ) ORDER BY v.created_at DESC)
       FROM public.vacancies v
       WHERE v.org_id = o.id AND v.status = 'active'),
      '[]'::jsonb
    ) AS vacancies
  FROM public.organizations o
  WHERE o.subdomain = _subdomain
    AND COALESCE(o.custom_features->>'subdomain', 'false') = 'true'
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_vacancies_board(text) TO anon, authenticated;