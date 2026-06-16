import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        // Mismo callback estable que se usa al iniciar OAuth.
        const origin = process.env.PUBLIC_APP_URL || "https://fluxtalent.lovable.app";

        if (error || !code || !state) {
          throw redirect({ to: "/app/integrations", search: { error: error || "missing_code" } as any });
        }
        const { verifyOAuthState } = await import("@/lib/scheduling.functions");
        const verified = await verifyOAuthState(state);
        if (!verified) {
          throw redirect({ to: "/app/integrations", search: { error: "invalid_state" } as any });
        }

        const { exchangeCodeForTokens, getUserInfo } = await import("@/lib/google.server");
        const tokens = await exchangeCodeForTokens(code, `${origin}/api/public/google/callback`);
        if (!tokens.refresh_token) {
          throw redirect({ to: "/app/integrations", search: { error: "no_refresh" } as any });
        }
        const info = await getUserInfo(tokens.access_token);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: updErr } = await supabaseAdmin.from("profiles").update({
          google_refresh_token: tokens.refresh_token,
          google_email: info.email,
          google_connected_at: new Date().toISOString(),
        }).eq("id", verified.userId);
        if (updErr) {
          throw redirect({ to: "/app/integrations", search: { error: "store_failed" } as any });
        }
        throw redirect({ to: "/app/integrations", search: { ok: "1" } as any });
      },
    },
  },
});
