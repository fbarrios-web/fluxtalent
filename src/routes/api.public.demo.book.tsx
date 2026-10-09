import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DEMO_COPY_EMAILS } from "@/lib/demo-scheduling.config";

const schema = z.object({
  slotId: z.string().uuid(),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6).max(50),
  website: z.string().max(0).optional().default(""),
});

export const Route = createFileRoute("/api/public/demo/book")({
  server: { handlers: { POST: async ({ request }) => {
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ error: "Revisá los datos ingresados." }, { status: 400 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reserved, error: reserveError } = await supabaseAdmin.rpc("reserve_demo_slot", {
      _slot_id: parsed.data.slotId,
      _first_name: parsed.data.firstName,
      _last_name: parsed.data.lastName,
      _email: parsed.data.email,
      _phone: parsed.data.phone,
    });
    if (reserveError || !reserved) return Response.json({ error: reserveError?.message ?? "El horario ya no está disponible." }, { status: 409 });

    const booking = reserved as { booking_id: string; start_at: string; end_at: string; first_name: string; last_name: string; email: string; phone: string };
    const { data: config } = await supabaseAdmin.from("demo_scheduling_config").select("organizer_id, timezone, enabled").eq("id", true).maybeSingle();
    if (!config?.enabled) {
      await supabaseAdmin.rpc("release_demo_slot", { _booking_id: booking.booking_id });
      return Response.json({ error: "La agenda no está disponible por el momento." }, { status: 409 });
    }
    const { data: organizer } = await supabaseAdmin.from("profiles")
      .select("id, google_refresh_token, google_email, google_connected_at, microsoft_refresh_token, microsoft_email, microsoft_connected_at, display_name")
      .eq("id", config.organizer_id).maybeSingle();

    try {
      const { pickProvider, providerAccessToken, createUserMeetingEvent } = await import("@/lib/mail-provider.server");
      const provider = organizer ? pickProvider(organizer) : null;
      if (!organizer || provider !== "google") throw new Error("La cuenta Google organizadora no está conectada.");
      const accessToken = await providerAccessToken(organizer, provider);
      const prospectName = `${booking.first_name} ${booking.last_name}`;
      const attendees = [{ email: booking.email, name: prospectName }, ...DEMO_COPY_EMAILS.map(email => ({ email }))];
      const description = `Demo de FLUX Talent\nProspecto: ${prospectName}\nEmail: ${booking.email}\nTeléfono: ${booking.phone}`;
      const event = await createUserMeetingEvent({
        provider,
        accessToken,
        summary: `Demo FLUX Talent — ${prospectName}`,
        descriptionText: description,
        descriptionHtml: `<p>${description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</p>`,
        startISO: booking.start_at,
        endISO: booking.end_at,
        timezone: config.timezone,
        attendees,
      });
      const meetLink = event.meetingLink ?? event.webLink;
      await supabaseAdmin.from("demo_bookings").update({ status: "confirmed", google_event_id: event.eventId, meet_link: meetLink }).eq("id", booking.booking_id);

      const whenLabel = new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short", timeZone: config.timezone }).format(new Date(booking.start_at));
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      let emailWarning: string | null = null;
      try {
        await sendTemplateEmail("demo-confirmation", booking.email, {
          idempotencyKey: `demo-confirmation:${booking.booking_id}`,
          replyTo: "fbarrios@fluxtalent.com.ar",
          templateData: { firstName: booking.first_name, whenLabel, meetLink },
        });
      } catch (error) {
        console.error("[demo.book] confirmation email failed", error);
        emailWarning = "La reserva se confirmó, pero no pudimos enviar el email adicional. La invitación de Google Calendar sí fue enviada.";
      }
      return Response.json({ ok: true, meetLink, whenLabel, emailWarning });
    } catch (error) {
      console.error("[demo.book] meeting creation failed", error);
      await supabaseAdmin.rpc("release_demo_slot", { _booking_id: booking.booking_id });
      return Response.json({ error: "No pudimos crear la reunión. Probá nuevamente." }, { status: 500 });
    }
  } } },
});