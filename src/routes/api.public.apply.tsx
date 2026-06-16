import { createFileRoute } from "@tanstack/react-router";

// Public endpoint to receive applications from the apply form.
// FormData with: vacancy_id, first_name, last_name, email, phone, linkedin, answers (json), cv (File)
export const Route = createFileRoute("/api/public/apply")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      POST: async ({ request }) => {
        const cors = { "Access-Control-Allow-Origin": "*" };
        try {
          const form = await request.formData();
          const vacancyId = String(form.get("vacancy_id") ?? "");
          const first_name = String(form.get("first_name") ?? "").trim();
          const last_name = String(form.get("last_name") ?? "").trim();
          const email = String(form.get("email") ?? "").trim().toLowerCase();
          const phone = String(form.get("phone") ?? "").trim() || null;
          const linkedin = String(form.get("linkedin") ?? "").trim() || null;
          const answers = JSON.parse(String(form.get("answers") ?? "{}"));
          const cv = form.get("cv") as File | null;

          if (!vacancyId || !first_name || !last_name || !email) {
            return Response.json({ error: "Faltan campos requeridos" }, { status: 400, headers: cors });
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return Response.json({ error: "Email inválido" }, { status: 400, headers: cors });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: vac, error: vErr } = await supabaseAdmin
            .from("vacancies")
            .select("id, org_id, status")
            .eq("id", vacancyId)
            .single();
          if (vErr || !vac || vac.status !== "active") {
            return Response.json({ error: "Vacante no disponible" }, { status: 404, headers: cors });
          }

          let cv_url: string | null = null;
          if (cv && cv.size > 0) {
            if (cv.size > 10 * 1024 * 1024) {
              return Response.json({ error: "CV mayor a 10MB" }, { status: 400, headers: cors });
            }
            const ext = (cv.name.split(".").pop() || "pdf").toLowerCase();
            const path = `${vac.org_id}/${vac.id}/${crypto.randomUUID()}.${ext}`;
            const buf = new Uint8Array(await cv.arrayBuffer());
            const { error: upErr } = await supabaseAdmin.storage.from("cvs").upload(path, buf, {
              contentType: cv.type || "application/pdf",
              upsert: false,
            });
            if (upErr) return Response.json({ error: "Error al subir CV" }, { status: 500, headers: cors });
            cv_url = path;
          }

          const { data: appRow, error: insErr } = await supabaseAdmin
            .from("applications")
            .insert({
              vacancy_id: vac.id,
              org_id: vac.org_id,
              first_name, last_name, email, phone, linkedin,
              cv_url,
              screening_answers: answers,
              ai_status: cv_url ? "pending" : "skipped",
            })
            .select("id")
            .single();
          if (insErr) return Response.json({ error: insErr.message }, { status: 500, headers: cors });

          // fire-and-forget AI analysis
          if (cv_url) {
            const baseUrl = new URL(request.url).origin;
            fetch(`${baseUrl}/api/public/analyze`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ applicationId: appRow.id, secret: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 8) }),
            }).catch(() => {});
          }

          return Response.json({ ok: true, id: appRow.id }, { headers: cors });
        } catch (e: any) {
          return Response.json({ error: e.message ?? "error" }, { status: 500, headers: cors });
        }
      },
    },
  },
});
