import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/schedule/logo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const slug = url.searchParams.get("slug");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let orgId: string | null = null;
        if (token && /^[0-9a-f-]{36}$/i.test(token)) {
          const { data: booking } = await supabaseAdmin
            .from("interview_bookings").select("org_id").eq("booking_token", token).maybeSingle();
          orgId = booking?.org_id ?? null;
        } else if (slug && /^[a-z0-9-]{4,64}$/i.test(slug)) {
          const { data: vac } = await supabaseAdmin
            .from("vacancies").select("org_id").eq("public_slug", slug).eq("status", "active").maybeSingle();
          orgId = vac?.org_id ?? null;
        } else {
          return Response.json({ url: null }, { status: 400 });
        }
        if (!orgId) return Response.json({ url: null }, { status: 404 });
        const { data: org } = await supabaseAdmin
          .from("organizations").select("logo_url").eq("id", orgId).maybeSingle();
        const raw = org?.logo_url ?? null;
        if (!raw) return Response.json({ url: null });
        if (raw.startsWith("http")) return Response.json({ url: raw });
        const { data: signed } = await supabaseAdmin.storage
          .from("org-assets").createSignedUrl(raw, 60 * 60 * 24 * 7);
        return Response.json({ url: signed?.signedUrl ?? null });
      },
    },
  },
});
