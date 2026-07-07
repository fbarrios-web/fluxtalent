UPDATE public.organizations
SET brand_color = CASE
  WHEN regexp_replace(trim(brand_color), '^#', '') ~ '^[0-9a-fA-F]{6}$'
    THEN '#' || lower(regexp_replace(trim(brand_color), '^#', ''))
  ELSE '#0F766E'
END
WHERE brand_color IS NOT NULL
  AND brand_color <> ('#' || lower(regexp_replace(trim(brand_color), '^#', '')));