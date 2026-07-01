import { createFileRoute } from "@tanstack/react-router";

/**
 * Background worker that drains the AI analysis queue.
 * Called periodically by pg_cron (every minute). Also safe to call manually.
 *
 * Strategy:
 *  - `claim_pending_ai_analyses(limit, stale_seconds)` atomically picks up to N
 *    applications, flips them to 'running' and bumps `ai_attempts`. Stale 'running'
 *    rows (older than `stale_seconds`) are re-claimed so a crashed worker can't
 *    leave a CV stuck "Analizando" forever.
 *  - Each claimed application is analyzed inside its own try/catch so one bad
 *    CV cannot stop the batch. Failures bump `ai_last_error` and schedule a
 *    backoff; after 5 attempts the row stays at `ai_status='error'` (terminal).
 *  - Concurrency is bounded so a single invocation respects the worker time
 *    budget. pg_cron fires every minute, so any backlog drains progressively.
 *
 * Auth: Supabase anon `apikey` header — same pattern as other public hooks.
 */

const BATCH_SIZE = 25;
const CONCURRENCY = 8;
const STALE_SECONDS = 180; // a row stuck in 'running' longer than this is re-claimed
const MAX_ATTEMPTS = 5;
const MAX_LIMIT = 50;

export const Route = createFileRoute("/api/public/hooks/process-cv-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        const provided = request.headers.get("apikey") || request.headers.get("x-apikey");
        if (!expected || !provided || provided !== expected) {
          return new Response("Forbidden", { status: 403 });
        }

        let limit = BATCH_SIZE;
        try {
          const body = (await request.json().catch(() => ({}))) as { limit?: number };
          if (typeof body.limit === "number" && body.limit > 0 && body.limit <= 25) {
            limit = body.limit;
          }
        } catch { /* empty body is fine */ }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runAnalysisAdmin } = await import("@/lib/analyze.server");

        const { data: claimed, error: claimErr } = await supabaseAdmin.rpc(
          "claim_pending_ai_analyses",
          { _limit: limit, _stale_seconds: STALE_SECONDS },
        );
        if (claimErr) {
          console.error("[process-cv-queue] claim error", claimErr);
          return Response.json({ ok: false, error: claimErr.message }, { status: 500 });
        }

        const ids: string[] = (claimed ?? []).map((r: any) => r.application_id as string);
        if (ids.length === 0) {
          return Response.json({ ok: true, processed: 0, failed: 0, ids: [] });
        }

        let processed = 0;
        let failed = 0;

        // Bounded-concurrency runner.
        const queue = [...ids];
        async function worker() {
          while (queue.length) {
            const appId = queue.shift();
            if (!appId) return;
            try {
              await runAnalysisAdmin(supabaseAdmin, appId);
              processed++;
            } catch (e: any) {
              failed++;
              const msg = (e?.message ?? String(e)).slice(0, 500);
              console.error("[process-cv-queue] analysis failed", appId, msg);
              // Decide next state: terminal 'error' after MAX_ATTEMPTS, else
              // back to 'pending' with exponential backoff (1m, 2m, 4m, ...).
              const { data: row } = await supabaseAdmin
                .from("applications")
                .select("ai_attempts")
                .eq("id", appId)
                .maybeSingle();
              const attempts = Number(row?.ai_attempts ?? 0);
              if (attempts >= MAX_ATTEMPTS) {
                await supabaseAdmin
                  .from("applications")
                  .update({ ai_status: "error", ai_last_error: msg })
                  .eq("id", appId);
              } else {
                const backoffMs = Math.min(60_000 * 2 ** (attempts - 1), 15 * 60_000);
                await supabaseAdmin
                  .from("applications")
                  .update({
                    ai_status: "pending",
                    ai_last_error: msg,
                    ai_next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
                  })
                  .eq("id", appId);
              }
            }
          }
        }
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

        return Response.json({ ok: true, claimed: ids.length, processed, failed, ids });
      },
      GET: async () => new Response("ok"),
    },
  },
});
