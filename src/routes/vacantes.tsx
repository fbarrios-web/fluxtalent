import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Briefcase, ArrowRight, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { MAIN_APP_HOST, vacancyPublicUrl } from "@/lib/vacancy-url";

export const Route = createFileRoute("/vacantes")({
  component: VacanciesBoard,
  head: () => ({
    meta: [
      { title: "Vacantes abiertas — FLUX Talent" },
      { name: "description", content: "Conocé las búsquedas activas y postulate en unos minutos." },
      { property: "og:title", content: "Vacantes abiertas — FLUX Talent" },
      { property: "og:description", content: "Conocé las búsquedas activas y postulate en unos minutos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function seniorityLabel(value: string | null | undefined, t: (k: string) => string) {
  const labels: Record<string, string> = { intern: "Pasantía", junior: "Junior", mid: "Semi Senior", senior: "Senior", lead: "Líder", manager: "Manager", director: "Director" };
  return value ? t(labels[value] ?? value) : "";
}

function modalityLabel(value: string | null | undefined, t: (k: string) => string) {
  const labels: Record<string, string> = { remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial" };
  return value ? t(labels[value] ?? value) : "";
}

function currentSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  // Permite previsualizar el portal con ?org=<subdominio> desde cualquier dominio.
  const preview = new URLSearchParams(window.location.search).get("org");
  if (preview) return preview;
  const host = window.location.host;
  if (!host.endsWith(`.${MAIN_APP_HOST}`)) return null;
  const sub = host.slice(0, host.length - MAIN_APP_HOST.length - 1);
  return sub && sub !== "www" ? sub : null;
}

function VacanciesBoard() {
  const t = useT();
  const [sub, setSub] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setSub(currentSubdomain());
    setMounted(true);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["public-vacancies-board", sub],
    enabled: !!sub,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_vacancies_board", { _subdomain: sub! });
      return (data as any)?.[0] ?? null;
    },
  });
  const { data: logoUrl } = useQuery({
    queryKey: ["public-board-logo", sub],
    enabled: !!sub,
    queryFn: async () => {
      const r = await fetch(`/api/public/schedule/logo?subdomain=${encodeURIComponent(sub!)}`);
      const j = await r.json().catch(() => ({}));
      return (j?.url as string | null) ?? null;
    },
  });

  const vacancies: any[] = data?.vacancies ?? [];
  const brand = data?.org_brand_color || undefined;

  if (!mounted || (mounted && sub && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">{t("Organización no encontrada")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {brand && (
        <div
          className="h-1.5 w-full"
          style={{ background: `linear-gradient(90deg, ${brand}, color-mix(in oklab, ${brand} 55%, white))` }}
        />
      )}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-3 px-4 py-10 sm:py-14">
          {logoUrl ? (
            <img src={logoUrl} alt={data?.org_name ?? ""} className="h-24 w-auto object-contain sm:h-32" />
          ) : (
            <h1 className="font-display text-3xl sm:text-4xl" style={brand ? { color: brand } : undefined}>
              {data?.org_name ?? ""}
            </h1>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h2 className="font-display text-xl sm:text-2xl">{t("Vacantes")}</h2>
        <div className="mt-1.5 h-1 w-12 rounded-full" style={{ backgroundColor: brand }} />
        <p className="mt-2 text-sm text-muted-foreground">{t("Conocé nuestras búsquedas activas y postulate.")}</p>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && !vacancies.length && (
          <p className="py-16 text-center text-muted-foreground">{t("No hay búsquedas activas en este momento.")}</p>
        )}

        <div className="mt-6 space-y-3">
          {vacancies.map((v) => (
            <a
              key={v.id}
              href={vacancyPublicUrl(v)}
              className="group block rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug" style={brand ? { color: brand } : undefined}>
                    {v.title}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {v.area && (
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3 w-3" /> {v.area}
                        {seniorityLabel(v.seniority, t) ? ` · ${seniorityLabel(v.seniority, t)}` : ""}
                      </span>
                    )}
                    {v.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {v.location}
                      </span>
                    )}
                    {modalityLabel(v.modality, t) && <span>{modalityLabel(v.modality, t)}</span>}
                  </div>
                  {v.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{v.description}</p>
                  )}
                </div>
                <span
                  className={
                    brand
                      ? "mt-1 inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity group-hover:opacity-90"
                      : "mt-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium transition-colors group-hover:bg-accent"
                  }
                  style={brand ? { backgroundColor: brand } : undefined}
                >
                  {t("Postularme")}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
