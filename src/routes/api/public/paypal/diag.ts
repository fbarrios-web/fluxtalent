import { createFileRoute } from "@tanstack/react-router";
import { PAYPAL_CLIENT_ID, PAYPAL_PLAN_IDS } from "@/lib/paypal";

// Diagnóstico temporal: no expone secretos, solo estado de configuración.
export const Route = createFileRoute("/api/public/paypal/diag")({
  server: {
    handlers: {
      GET: async () => {
        const { paypalFetch, paypalConfigured } = await import("@/lib/paypal.server");
        const envClient = process.env.PAYPAL_CLIENT_ID ?? "";
        const out: any = {
          env: process.env.PAYPAL_ENV ?? "live",
          configured: paypalConfigured(),
          clientIdMatchesPublic: envClient === PAYPAL_CLIENT_ID,
          publicClientIdPrefix: PAYPAL_CLIENT_ID.slice(0, 6),
          envClientIdPrefix: envClient.slice(0, 6),
          plans: {} as Record<string, any>,
        };
        for (const [k, id] of Object.entries(PAYPAL_PLAN_IDS)) {
          if (!id) continue;
          const res = await paypalFetch(`/v1/billing/plans/${id}`);
          if (!res) { out.plans[k] = { error: "no-token" }; continue; }
          const body: any = await res.json().catch(() => ({}));
          out.plans[k] = res.ok
            ? { status: body.status, name: body.name, product_id: body.product_id }
            : { httpStatus: res.status, name: body?.name, message: body?.message };
        }
        return Response.json(out, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
