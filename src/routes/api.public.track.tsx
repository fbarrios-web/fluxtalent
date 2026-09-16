import { createFileRoute } from "@tanstack/react-router";

const EXCLUDED_PREFIXES = ["/apply", "/schedule", "/api", "/auth/impersonate", "/email"];
const ok = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function str(v: unknown, max = 300) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      GET: async () => ok({ ok: true, service: "web-track" }),
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return ok({ ok: false });
        }

        const sessionKey = str(payload?.session_key, 80);
        const type = payload?.type === "action" ? "action" : "pageview";
        const path = str(payload?.path, 200);
        if (!sessionKey) return ok({ ok: false });
        if (path && EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return ok({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const sb = supabaseAdmin;

        const referrer = str(payload?.referrer, 500);
        const refHost = hostOf(referrer);
        const selfHost = hostOf(request.headers.get("origin") || request.url);
        const country =
          request.headers.get("cf-ipcountry") ||
          request.headers.get("x-vercel-ip-country") ||
          request.headers.get("x-country-code") ||
          null;

        const now = new Date().toISOString();
        const { data: existing } = await sb
          .from("web_sessions")
          .select("id, page_views")
          .eq("session_key", sessionKey)
          .maybeSingle();

        if (!existing) {
          await sb.from("web_sessions").insert({
            session_key: sessionKey,
            first_seen: now,
            last_seen: now,
            landing_path: path,
            referrer,
            referrer_host: refHost && refHost !== selfHost ? refHost : null,
            utm_source: str(payload?.utm_source, 80),
            utm_medium: str(payload?.utm_medium, 80),
            utm_campaign: str(payload?.utm_campaign, 120),
            utm_content: str(payload?.utm_content, 120),
            utm_term: str(payload?.utm_term, 120),
            device_type: str(payload?.device_type, 20),
            os: str(payload?.os, 40),
            browser: str(payload?.browser, 40),
            country: country ? country.slice(0, 4) : null,
            language: str(payload?.language, 12),
            page_views: type === "pageview" ? 1 : 0,
          });
        } else {
          const patch: { last_seen: string; page_views?: number } = { last_seen: now };
          if (type === "pageview") patch.page_views = (existing.page_views ?? 0) + 1;
          await sb.from("web_sessions").update(patch).eq("id", existing.id);
        }

        await sb.from("web_events").insert({
          session_key: sessionKey,
          event_type: type,
          path,
          name: type === "action" ? str(payload?.name, 80) : null,
          metadata: typeof payload?.metadata === "object" && payload.metadata ? payload.metadata : {},
          created_at: now,
        });

        return ok();
      },
    },
  },
});
