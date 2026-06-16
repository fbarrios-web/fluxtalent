# Plan: Coordinación de entrevistas con Google Calendar + Meet

## Resumen
La reclutadora conecta su Google Calendar (OAuth por usuario), configura disponibilidad y branding del mail por cada vacante. Al mover un postulante a Entrevista 1/2/3 se envía un mail con link de reserva. El postulante elige slot, se crea el evento en Calendar con Meet, y ambos reciben confirmación con fecha/hora/link.

## Cambios en datos
- `organizations`: agregar `brand_primary_color`, `brand_logo_url`, `consultancy_name`, `contact_email`, `signature` (configuración de marca para mails).
- `profiles`: agregar `google_refresh_token`, `google_email`, `google_connected_at` (OAuth por reclutador).
- Nueva tabla `vacancy_scheduling`: por vacante → `duration_minutes`, `meeting_instructions`, `recruiter_id` (quién toma la entrevista, default created_by).
- Nueva tabla `availability_rules`: reglas recurrentes (vacancy_id, weekday, start_time, end_time, valid_until).
- Nueva tabla `availability_slots`: slots concretos generados o cargados manualmente (vacancy_id, start_at, end_at, status: open/blocked/booked, source: rule/manual).
- Nueva tabla `interview_bookings`: postulante reservó un slot (application_id, slot_id, stage: interview_1/2/3, google_event_id, meet_link, status: scheduled/cancelled, booking_token UUID público).

Todas con RLS por org_id (recruiters de la org), GRANT correspondientes. `availability_slots` permite UPDATE atómico para reservar (un solo postulante por slot vía `status='open'` en WHERE).

## Flujo

### 1. Reclutadora conecta Google Calendar
- Pantalla nueva `/app/integrations` con botón "Conectar Google Calendar".
- OAuth propio (Google Cloud OAuth client) — requiere que el usuario configure `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` como secretos. Scopes: `calendar.events`, `userinfo.email`.
- Server route público `/api/public/google/callback` recibe el code, intercambia por refresh_token, guarda en `profiles`.

### 2. Configurar vacante para entrevistas
En la página de la vacante, nueva tab "Entrevistas":
- Duración del slot (15/30/45/60 min).
- Reglas semanales (Lun-Vie 10-12, etc).
- Slots puntuales (agregar/bloquear fechas específicas).
- Botón "Regenerar próximos 30 días" que materializa la regla en `availability_slots`.

### 3. Configurar branding del mail
En "Configuración de la organización":
- Nombre consultora, mail de contacto, color primario, logo (Storage `org-assets`), firma.
- Usado en todos los mails al postulante.

### 4. Disparo del mail
Al cambiar el `stage` de una application a `interview_1`, `interview_2` o `interview_3`:
- Trigger en `applications` → llama server fn que envía mail con link `/schedule/{booking_token}` (token único por application+stage).
- Template branded con colores/logo de la org.

### 5. Página pública de reserva `/schedule/$token`
- Muestra slots libres de esa vacante (los próximos 14 días).
- Postulante elige slot → POST a `/api/public/schedule/book`:
  1. UPDATE atómico `availability_slots SET status='booked' WHERE id=? AND status='open'` — si afecta 0 filas, slot ya tomado, error.
  2. Refresh access_token del reclutador con su refresh_token.
  3. Crea evento en Google Calendar con `conferenceData` (Meet), invitados: postulante + reclutador.
  4. Guarda `interview_bookings` con `google_event_id` y `meet_link`.
  5. Envía mails de confirmación a postulante y reclutador con fecha/hora/link Meet.

## Mails (4 templates nuevos)
1. `interview-invite`: "Coordiná tu entrevista" → link `/schedule/{token}`.
2. `interview-confirmation-candidate`: confirmación al postulante con Meet link.
3. `interview-confirmation-recruiter`: notificación al reclutador.
4. (los existentes rejection/offer ya están).

Todos branded con campos de la org (color, logo, firma, mail de contacto).

## Secretos requeridos
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- Webhook callback URL: `https://fluxtalent.lovable.app/api/public/google/callback` (a configurar en Google Cloud Console).

## Detalles técnicos
- Server fns: `connectGoogle`, `disconnectGoogle`, `saveAvailabilityRules`, `regenerateSlots`, `getSchedulingConfig`, `triggerInterviewInvite`, `saveBranding`.
- Public routes: `/api/public/google/callback`, `/api/public/schedule/book`, `/api/public/schedule/$token` (GET slots).
- Server route `/schedule/$token` (página pública SSR-friendly con loader que llama public fn).
- Helper `googleCalendar.server.ts` con refresh token + create event con `conferenceDataVersion=1`.
- Concurrencia: confiamos en el UPDATE atómico con WHERE status='open' para evitar doble reserva.
- Cron opcional: regenerar slots automáticamente cada noche (futuro, no en este sprint).

## Fuera de alcance (este sprint)
- Reprogramación / cancelación por el postulante (puede hacerlo el reclutador manualmente).
- Recordatorios automáticos antes de la entrevista.
- Soporte multi-zona horaria por postulante (se muestra todo en zona del reclutador).
- Configurar dominio de mail (queda con remitente default; se puede activar después).

## Lo que necesito de vos antes de arrancar
1. Crear OAuth credentials en Google Cloud Console (te paso los pasos exactos) y pasarme `CLIENT_ID` + `CLIENT_SECRET`.
2. Confirmar zona horaria default (asumo `America/Argentina/Buenos_Aires`).
