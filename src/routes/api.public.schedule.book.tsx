import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Schema = z.object({
  token: z.string().uuid(),
  slotId: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/schedule/book")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Atomic reservation
        const { data: reserved, error: reserveErr } = await supabaseAdmin
          .rpc("reserve_slot", { _token: parsed.data.token, _slot_id: parsed.data.slotId });
        if (reserveErr) return Response.json({ error: reserveErr.message }, { status: 409 });
        const r = reserved as {
          booking_id: string; application_id: string; vacancy_id: string; org_id: string;
          stage: string; recruiter_id: string; start_at: string; end_at: string;
        };

        // 2) Load context
        const { data: app } = await supabaseAdmin.from("applications")
          .select("first_name, last_name, email").eq("id", r.application_id).single();
        const { data: vac } = await supabaseAdmin.from("vacancies")
          .select("title").eq("id", r.vacancy_id).single();
        const { data: org } = await supabaseAdmin.from("organizations")
          .select("name, consultancy_name, contact_email, brand_color, logo_url, signature_html, timezone")
          .eq("id", r.org_id).single();
        const { data: recruiter } = await supabaseAdmin.from("profiles")
          .select("google_refresh_token, google_email, google_connected_at, microsoft_refresh_token, microsoft_email, microsoft_connected_at, display_name").eq("id", r.recruiter_id).single();
        const { data: stageCfg } = await supabaseAdmin.from("vacancy_scheduling")
          .select("interviewer_email, extra_invitees")
          .eq("vacancy_id", r.vacancy_id).eq("stage", r.stage).maybeSingle();

        const { pickProvider, providerEmail, providerAccessToken, sendUserMail, createUserMeetingEvent } = await import("@/lib/mail-provider.server");
        const provider = recruiter ? pickProvider(recruiter as any) : null;

        if (!app || !vac || !org || !recruiter || !provider) {
          // Roll back the slot
          await supabaseAdmin.from("availability_slots").update({ status: "open" }).eq("id", parsed.data.slotId);
          await supabaseAdmin.from("interview_bookings").update({ slot_id: null, scheduled_at: null }).eq("id", r.booking_id);
          return Response.json({ error: "El proceso no está disponible. Contactá al reclutador." }, { status: 500 });
        }

        // 3) Create Calendar event
        const senderEmail = providerEmail(recruiter as any, provider);
        const { interviewConfirmCandidateHtml, interviewConfirmRecruiterHtml } = await import("@/lib/email-templates");
        const tz = org.timezone || "America/Argentina/Buenos_Aires";
        const candidateName = `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim() || app.email;
        const stageLabel: Record<string, string> = {
          interview_1: "Entrevista 1", interview_2: "Entrevista 2", interview_3: "Entrevista final",
        };
        const summary = `${stageLabel[r.stage]} — ${vac.title} — ${candidateName}`;

        const interviewerEmail = (stageCfg?.interviewer_email as string | null) || null;
        const extraInvitees = Array.isArray(stageCfg?.extra_invitees) ? (stageCfg!.extra_invitees as any[]).filter((e): e is string => typeof e === "string") : [];
        const attendeesMap = new Map<string, { email: string; name?: string }>();
        attendeesMap.set(app.email.toLowerCase(), { email: app.email, name: candidateName });
        if (interviewerEmail) attendeesMap.set(interviewerEmail.toLowerCase(), { email: interviewerEmail });
        attendeesMap.set(senderEmail.toLowerCase(), { email: senderEmail, name: recruiter.display_name ?? "" });
        for (const e of extraInvitees) attendeesMap.set(e.toLowerCase(), { email: e });

        try {
          const access_token = await providerAccessToken(recruiter as any, provider);
          const descriptionText = `Entrevista para ${vac.title}\nPostulante: ${candidateName} (${app.email})`;
          const event = await createUserMeetingEvent({
            provider,
            accessToken: access_token,
            summary,
            descriptionText,
            descriptionHtml: `<p>${descriptionText.replace(/\n/g, "<br/>")}</p>`,
            startISO: r.start_at,
            endISO: r.end_at,
            timezone: tz,
            attendees: Array.from(attendeesMap.values()),
          });

          await supabaseAdmin.from("interview_bookings").update({
            google_event_id: event.eventId,
            meet_link: event.meetingLink,
            status: "scheduled",
          }).eq("id", r.booking_id);

          // 4) Send branded confirmation mail to candidate (via provider)
          const whenLabel = new Intl.DateTimeFormat("es-AR", {
            timeZone: tz, dateStyle: "full", timeStyle: "short",
          }).format(new Date(r.start_at));
          const brand = {
            consultancyName: org.consultancy_name || org.name,
            contactEmail: org.contact_email,
            brandColor: org.brand_color || "#0F766E",
            logoUrl: org.logo_url,
            signatureHtml: org.signature_html,
          };
          let emailWarning: string | null = null;
          if (event.meetingLink) {
            try {
              await sendUserMail({
                profile: recruiter as any,
                provider,
                accessToken: access_token,
                fromName: brand.consultancyName,
                to: app.email,
                subject: `Confirmación de entrevista — ${vac.title}`,
                html: interviewConfirmCandidateHtml({
                  ...brand,
                  firstName: app.first_name || "",
                  vacancyTitle: vac.title,
                  whenLabel,
                  meetLink: event.meetingLink,
                }),
                replyTo: brand.contactEmail || undefined,
              });

              await sendUserMail({
                profile: recruiter as any,
                provider,
                accessToken: access_token,
                fromName: brand.consultancyName,
                to: senderEmail,
                subject: `Nueva entrevista agendada — ${candidateName}`,
                html: interviewConfirmRecruiterHtml({
                  ...brand,
                  candidateName,
                  candidateEmail: app.email,
                  vacancyTitle: vac.title,
                  whenLabel,
                  meetLink: event.meetingLink,
                }),
              });
            } catch (mailErr: any) {
              const msg = mailErr?.message ?? String(mailErr);
              console.error("[schedule.book] mail send failed:", msg);
              emailWarning = /insufficient.*scope|invalid_scope|ACCESS_TOKEN_SCOPE_INSUFFICIENT|Mail\.Send/i.test(msg)
                ? `El reclutador debe reconectar ${provider === "microsoft" ? "Microsoft" : "Google"} para autorizar el envío de mails.`
                : /SERVICE_DISABLED|has not been used|Gmail API has not been/i.test(msg)
                  ? "La API de correo no está habilitada en la cuenta del reclutador."
                  : `No se pudo enviar el mail de confirmación: ${msg}`;
            }
          }

          return Response.json({ ok: true, meetLink: event.meetingLink, emailWarning });

        } catch (e: any) {
          // Roll back
          await supabaseAdmin.from("availability_slots").update({ status: "open" }).eq("id", parsed.data.slotId);
          await supabaseAdmin.from("interview_bookings").update({ slot_id: null, scheduled_at: null }).eq("id", r.booking_id);
          return Response.json({ error: `No se pudo crear la reunión: ${e?.message ?? e}` }, { status: 500 });
        }

      },
    },
  },
});
