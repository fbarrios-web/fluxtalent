import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/geo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const h = request.headers;
        const country =
          h.get("cf-ipcountry") ||
          h.get("x-vercel-ip-country") ||
          h.get("x-country-code") ||
          null;
        return new Response(JSON.stringify({ country }), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
