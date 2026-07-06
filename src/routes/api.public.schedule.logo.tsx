import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/schedule/logo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
          return Response.json({ url: null }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: booking } = await supabaseAdmin
          .from("interview_bookings").select("org_id").eq("booking_token", token).maybeSingle();
        if (!booking) return Response.json({ url: null }, { status: 404 });
        const { data: org } = await supabaseAdmin
          .from("organizations").select("logo_url").eq("id", booking.org_id).maybeSingle();
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
