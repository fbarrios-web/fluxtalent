import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  staticData: { sitemap: false },
  beforeLoad: () => { throw redirect({ to: "/app/dashboard" }); },
});
