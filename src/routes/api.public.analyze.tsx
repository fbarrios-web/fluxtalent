import { createFileRoute } from "@tanstack/react-router";

// Internal-only AI analysis endpoint (called from server-side flows).
// Authenticated with a dedicated random shared secret (INTERNAL_ANALYZE_SECRET).
function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { applicationId?: string; secret?: string };
          const expected = process.env.INTERNAL_ANALYZE_SECRET;
          if (!expected || !body.secret || !timingSafeEq(body.secret, expected)) {
            return new Response("Forbidden", { status: 403 });
          }
          if (!body.applicationId) return new Response("Bad request", { status: 400 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runAnalysisAdmin } = await import("@/lib/analyze.server");
          await runAnalysisAdmin(supabaseAdmin, body.applicationId);
          return Response.json({ ok: true });
        } catch (e: any) {
          console.error("[analyze]", e);
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
