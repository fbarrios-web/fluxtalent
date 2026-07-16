import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/microsoft/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        if (error || !code || !state) {
          throw redirect({ to: "/app/integrations", search: { error: error || "missing_code" } as any });
        }
        const { verifyMicrosoftOAuthState } = await import("@/lib/microsoft.functions");
        const verified = await verifyMicrosoftOAuthState(state);
        if (!verified) {
          throw redirect({ to: "/app/integrations", search: { error: "invalid_state" } as any });
        }

        const { exchangeCodeForTokens, getUserInfo } = await import("@/lib/microsoft.server");
        const callbackUri = verified.callbackUri ?? `${process.env.PUBLIC_APP_URL || "https://fluxtalent.lovable.app"}/api/public/microsoft/callback`;
        const returnOrigin = verified.returnOrigin ?? "";
        const integrationsPath = returnOrigin ? `${returnOrigin}/app/integrations` : "/app/integrations";
        const tokens = await exchangeCodeForTokens(code, callbackUri);
        if (!tokens.refresh_token) {
          throw redirect({ href: `${integrationsPath}?error=no_refresh` });
        }
        const info = await getUserInfo(tokens.access_token);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: updErr } = await supabaseAdmin.from("profiles").update({
          microsoft_refresh_token: tokens.refresh_token,
          microsoft_email: info.email,
          microsoft_connected_at: new Date().toISOString(),
        }).eq("id", verified.userId);
        if (updErr) {
          throw redirect({ href: `${integrationsPath}?error=store_failed` });
        }
        throw redirect({ href: `${integrationsPath}?ok_ms=1` });
      },
    },
  },
});
