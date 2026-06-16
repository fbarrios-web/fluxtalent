import { createFileRoute } from "@tanstack/react-router";

// Public-callable AI analysis endpoint (called from apply handler via fetch).
// Validates a shared check derived from service role to prevent open abuse.
export const Route = createFileRoute("/api/public/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { applicationId?: string; secret?: string };
          const expected = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 8);
          if (!body.secret || body.secret !== expected) {
            return new Response("Forbidden", { status: 403 });
          }
          if (!body.applicationId) return new Response("Bad request", { status: 400 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runAnalysisAdmin } = await import("@/lib/analyze.server");
          await runAnalysisAdmin(supabaseAdmin, body.applicationId);
          return Response.json({ ok: true });
        } catch (e: any) {
          console.error("[analyze]", e);
          return Response.json({ error: e.message }, { status: 500 });
        }
      },
    },
  },
});
