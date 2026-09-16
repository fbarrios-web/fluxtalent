import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Row = { label: string; count: number };

function topOf(map: Record<string, number>, limit = 8): Row[] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function channelOf(s: any): string {
  const src = (s.utm_source || "").toLowerCase();
  const host = (s.referrer_host || "").toLowerCase();
  const hay = `${src} ${host} ${(s.browser || "").toLowerCase()}`;
  if (/facebook|fb|meta|instagram|ig/.test(hay)) return "Meta (Facebook / Instagram)";
  if (/google|adwords|gclid/.test(hay)) return "Google";
  if (/linkedin|lnkd/.test(hay)) return "LinkedIn";
  if (/whatsapp|wa\.me/.test(hay)) return "WhatsApp";
  if (/tiktok/.test(hay)) return "TikTok";
  if (/mail|gmail|outlook/.test(hay)) return "Email";
  if (src) return src;
  if (host) return host;
  return "Directo";
}

export const adminTraffic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().min(1).max(180).default(30) }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Acción solo permitida para administradores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin;
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    const [{ data: sessions }, { data: events }] = await Promise.all([
      sb.from("web_sessions").select("*").gte("first_seen", since).order("first_seen", { ascending: false }).limit(20000),
      sb.from("web_events").select("session_key, event_type, path, name, created_at").gte("created_at", since).limit(50000),
    ]);

    const ss = sessions ?? [];
    const ev = events ?? [];

    const bySource: Record<string, number> = {};
    const byDevice: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byBrowser: Record<string, number> = {};
    const byLanding: Record<string, number> = {};
    const byCampaign: Record<string, number> = {};
    const daily: Record<string, { sessions: number; signups: number }> = {};

    for (let i = data.days - 1; i >= 0; i--) {
      const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      daily[key] = { sessions: 0, signups: 0 };
    }

    let durationSum = 0;
    let durationCount = 0;
    let bounced = 0;
    let signups = 0;

    for (const s of ss) {
      bySource[channelOf(s)] = (bySource[channelOf(s)] ?? 0) + 1;
      byDevice[s.device_type || "desconocido"] = (byDevice[s.device_type || "desconocido"] ?? 0) + 1;
      byCountry[s.country || "??"] = (byCountry[s.country || "??"] ?? 0) + 1;
      byBrowser[s.browser || "Otro"] = (byBrowser[s.browser || "Otro"] ?? 0) + 1;
      if (s.landing_path) byLanding[s.landing_path] = (byLanding[s.landing_path] ?? 0) + 1;
      if (s.utm_campaign) byCampaign[s.utm_campaign] = (byCampaign[s.utm_campaign] ?? 0) + 1;

      const day = String(s.first_seen).slice(0, 10);
      if (daily[day]) daily[day].sessions += 1;
      if (s.signed_up) {
        signups += 1;
        if (daily[day]) daily[day].signups += 1;
      }

      const dur = (new Date(s.last_seen).getTime() - new Date(s.first_seen).getTime()) / 1000;
      if (dur > 0 && dur < 4 * 3600) {
        durationSum += dur;
        durationCount += 1;
      }
      if ((s.page_views ?? 0) <= 1) bounced += 1;
    }

    // Páginas y acciones
    const byPage: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const sessionsWith = (pred: (e: any) => boolean) => {
      const set = new Set<string>();
      ev.forEach((e) => { if (pred(e)) set.add(e.session_key); });
      return set;
    };
    for (const e of ev) {
      if (e.event_type === "pageview" && e.path) byPage[e.path] = (byPage[e.path] ?? 0) + 1;
      if (e.event_type === "action" && e.name) byAction[e.name] = (byAction[e.name] ?? 0) + 1;
    }

    const visited = (p: string) => sessionsWith((e) => e.event_type === "pageview" && (e.path === p || String(e.path || "").startsWith(p))).size;
    const didAction = (n: string) => sessionsWith((e) => e.event_type === "action" && e.name === n).size;

    const funnel = [
      { step: "Visitó la web", count: ss.length },
      { step: "Abrió registro / login", count: visited("/auth") },
      { step: "Creó la cuenta", count: signups || didAction("signup_completed") },
      { step: "Completó configuración", count: visited("/app/setup") },
      { step: "Entró al panel", count: visited("/app/dashboard") },
      { step: "Abrió crear vacante", count: visited("/app/vacancies/new") },
      { step: "Creó la vacante", count: didAction("vacancy_created") },
    ];

    return {
      days: data.days,
      totals: {
        sessions: ss.length,
        pageviews: ev.filter((e) => e.event_type === "pageview").length,
        signups,
        conversion: ss.length ? Math.round((signups / ss.length) * 1000) / 10 : 0,
        avgSeconds: durationCount ? Math.round(durationSum / durationCount) : 0,
        bounceRate: ss.length ? Math.round((bounced / ss.length) * 1000) / 10 : 0,
      },
      bySource: topOf(bySource),
      byDevice: topOf(byDevice, 5),
      byCountry: topOf(byCountry, 8),
      byBrowser: topOf(byBrowser, 6),
      byLanding: topOf(byLanding, 8),
      byCampaign: topOf(byCampaign, 8),
      byPage: topOf(byPage, 10),
      byAction: topOf(byAction, 10),
      daily: Object.entries(daily).map(([date, v]) => ({ date: date.slice(5), ...v })),
      funnel,
    };
  });
