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
            return Response.json({ error: "Esta vacante no está recibiendo postulaciones en este momento." }, { status: 404, headers: cors });
          }

          // Block postulations when the organization's subscription is inactive
          // (canceled past period_end, past_due, or trial expired).
          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("subscription_status, trial_ends_at, current_period_end")
            .eq("id", vac.org_id)
            .maybeSingle();
          const now = Date.now();
          const trialEnds = org?.trial_ends_at ? new Date(org.trial_ends_at).getTime() : 0;
          const periodEnds = org?.current_period_end ? new Date(org.current_period_end).getTime() : 0;
          const subActive =
            (org?.subscription_status === "trialing" && trialEnds > now) ||
            (org?.subscription_status === "active" && (!org.current_period_end || periodEnds > now)) ||
            (org?.subscription_status === "canceled" && periodEnds > now);
          if (!subActive) {
            return Response.json({ error: "Esta vacante no está recibiendo postulaciones en este momento." }, { status: 403, headers: cors });
          }

          // Block duplicate applications by email per vacancy
          const { data: dup } = await supabaseAdmin
            .from("applications")
            .select("id")
            .eq("vacancy_id", vac.id)
            .ilike("email", email)
            .maybeSingle();
          if (dup) {
            return Response.json({ error: "Ya te postulaste a esta vacante con este email." }, { status: 409, headers: cors });
          }
          // Enforce plan CV-per-month cap (Free = 20, Starter = 200, etc.).
          const { getOrgPlan, getCvsThisMonth } = await import("@/lib/plan-limits");
          const planForOrg = await getOrgPlan(supabaseAdmin, vac.org_id);
          if (planForOrg.maxCvsPerMonth !== -1) {
            const usedCvs = await getCvsThisMonth(supabaseAdmin, vac.org_id);
            if (usedCvs >= planForOrg.maxCvsPerMonth) {
              return Response.json({
                error: "Esta vacante alcanzó el cupo de postulaciones del mes. Probá nuevamente más adelante.",
              }, { status: 403, headers: cors });
            }
          }


          const ALLOWED_CV_EXTS = new Set(["pdf", "doc", "docx", "odt", "rtf"]);
          const ALLOWED_CV_MIMES = new Set([
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.oasis.opendocument.text",
            "application/rtf",
            "text/rtf",
          ]);
          let cv_url: string | null = null;
          if (cv && cv.size > 0) {
            if (cv.size > 10 * 1024 * 1024) {
              return Response.json({ error: "CV mayor a 10MB" }, { status: 400, headers: cors });
            }
            const ext = (cv.name.split(".").pop() || "pdf").toLowerCase();
            if (!ALLOWED_CV_EXTS.has(ext)) {
              return Response.json({ error: "Tipo de archivo no soportado. Usá PDF o Word." }, { status: 400, headers: cors });
            }
            if (cv.type && !ALLOWED_CV_MIMES.has(cv.type)) {
              return Response.json({ error: "Tipo de archivo no soportado. Usá PDF o Word." }, { status: 400, headers: cors });
            }
            const path = `${vac.org_id}/${vac.id}/${crypto.randomUUID()}.${ext}`;
            const buf = new Uint8Array(await cv.arrayBuffer());
            const { error: upErr } = await supabaseAdmin.storage.from("cvs").upload(path, buf, {
              contentType: cv.type || "application/pdf",
              upsert: false,
            });
            if (upErr) {
              console.error("[apply] cv upload", upErr);
              return Response.json({ error: "Error al subir CV" }, { status: 500, headers: cors });
            }
            cv_url = path;
          }

          // Auto-discard rule: if any answer selects an option marked discard=true.
          let autoDiscard = false;
          const { data: qs } = await supabaseAdmin
            .from("screening_questions")
            .select("question, qtype, options")
            .eq("vacancy_id", vac.id);
          for (const q of qs ?? []) {
            const ans = (answers as any)[(q as any).question];
            const opts: any[] = ((q as any).options ?? []) as any[];
            if (!opts.length || ans == null) continue;
            const chosen: string[] = Array.isArray(ans) ? ans : [String(ans)];
            if (opts.some(o => o?.discard && chosen.includes(o.value))) {
              autoDiscard = true; break;
            }
          }

          // Plan cap was already enforced above; analyze any uploaded CV.

          const analyzeAi = !!cv_url;

          const { data: appRow, error: insErr } = await supabaseAdmin
            .from("applications")
            .insert({
              vacancy_id: vac.id,
              org_id: vac.org_id,
              first_name, last_name, email, phone, linkedin,
              cv_url,
              screening_answers: answers,
              ai_status: analyzeAi ? "pending" : "skipped",
              stage: autoDiscard ? ("rejected" as any) : undefined,
            })
            .select("id")
            .single();
          if (insErr) {
            console.error("[apply] insert", insErr);
            return Response.json({ error: "Error al procesar la postulación. Intentá de nuevo." }, { status: 500, headers: cors });
          }

          // Best-effort low-latency kick: dispatch the analysis right away so
          // ideal-case CVs finish in a few seconds. The handler is cancelled
          // when the response is sent on Cloudflare Workers, so this is NOT
          // reliable on its own — the row stays at ai_status='pending' and a
          // pg_cron-backed worker (/api/public/hooks/process-cv-queue) drains
          // it within ~1 minute and retries with backoff if anything fails.
          if (analyzeAi) {
            const origin = process.env.PUBLIC_APP_URL || new URL(request.url).origin;
            const secret = process.env.INTERNAL_ANALYZE_SECRET;
            if (secret) {
              void fetch(`${origin}/api/public/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ applicationId: appRow.id, secret }),
              }).catch(() => {});
            }
          }



          return Response.json({ ok: true, id: appRow.id }, { headers: cors });
        } catch (e: any) {
          console.error("[apply]", e);
          return Response.json({ error: "Error al procesar la postulación. Intentá de nuevo." }, { status: 500, headers: cors });
        }
      },
    },
  },
});
