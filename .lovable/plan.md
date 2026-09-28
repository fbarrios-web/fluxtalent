# Plan "Custom" + subdominio Freddo + datos sensibles

## 1. Plan "Custom" en el panel admin
- En Organizaciones → asignar plan: nueva opción **Custom**.
- Custom = vacantes ilimitadas + CVs ilimitados + un set de funciones personalizadas que se prenden por organización (checkboxes en el admin):
  - Subdominio propio (ej. `freddo`)
  - Datos sensibles en formulario
  - Test de personalidad (queda **apagado y oculto** hasta que definas el test; la columna "Test" no aparece)
- Se asigna Custom a Freddo (recursoshumanos@freddo.com.ar) con subdominio `freddo` y "Datos sensibles" activado.
- El resto de las cuentas no cambia.

## 2. Subdominio freddo.fluxtalent.com.ar
- Las vacantes **nuevas** de Freddo muestran y copian el link `https://freddo.fluxtalent.com.ar/apply/CODIGO`.
- Las vacantes existentes y los CVs ya cargados no se tocan: sus links actuales siguen funcionando igual (y también abren desde el subdominio).
- Si alguien abre en el subdominio una vacante de otra organización, se redirige al dominio general.
- Mismo diseño y funcionamiento actual del formulario.

## 3. Datos sensibles obligatorios
- En Configuración (solo cuentas con la función activa): sección "Datos fijos del formulario" para definir **hasta 3 campos** (nombre del dato + tipo: texto, número, fecha). Ej.: DNI, fecha de nacimiento, domicilio.
- En cada vacante (crear/editar): interruptor por cada dato para pedirlo o no en ese formulario. Por defecto, prendidos.
- En el formulario del postulante aparecen como obligatorios; no se puede enviar sin completarlos (validado también en el servidor).
- Las respuestas se ven en la ficha del candidato, visibles solo para la organización.

## Consumo de IA estimado (mensual)
- Costo real observado: ~US$0,01 por CV analizado (≈9,7 créditos por ~1.000 CVs en el último mes).
- Freddo (temporada, 1.000–3.000 CVs/mes): **US$10–30**. Con entrevistas y emails con IA, sumar ~US$2–5.
- Resto de cuentas (volumen actual): **US$5–10**.
- Total recomendado: límite de IA de **US$25–40/mes** en temporada alta; hoy está en 10, que se quedaría corto si Freddo sube de volumen.

## Pendiente
- Test de personalidad y su columna/filtro: se hacen cuando pases la definición.

## Detalles técnicos
- `organizations`: columnas `subdomain` (único), `custom_features jsonb`, `sensitive_fields jsonb` (máx. 3); `vacancies.sensitive_field_ids jsonb`; `applications.sensitive_answers jsonb`. GRANT/RLS existentes cubren estas tablas.
- `planByPrice`/`getOrgPlan`: plan `custom` con `is_unlimited`-like limits vía `plan_id = 'custom'`.
- Link de vacante: helper `vacancyPublicUrl(org, slug)` usado en listado, detalle y copiar link; solo usa subdominio si la vacante se creó después de activarlo (`vacancies.public_host` guardado al crear).
- `/apply/$slug`: detecta host; `get_public_vacancy_by_slug` devuelve campos sensibles activos; `api.public.apply` los valida.
