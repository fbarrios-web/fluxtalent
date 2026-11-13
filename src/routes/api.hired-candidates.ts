import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/hired-candidates")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleHiredCandidates } = await import("@/lib/hired-candidates.server");
        return handleHiredCandidates(request);
      },
    },
  },
});