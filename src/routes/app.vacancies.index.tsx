import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ExternalLink, Download, Search, Copy, Share2, Check } from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { vacancyPublicUrl, MAIN_APP_HOST } from "@/lib/vacancy-url";
import { UsageCard } from "@/components/usage-card";
import { PromoNotice } from "@/components/promo-notice";
import { useT } from "@/lib/i18n";


export const Route = createFileRoute("/app/vacancies/")({
  component: VacanciesList,
  head: () => ({ meta: [{ title: "Vacantes — FLUX Talent" }] }),
});

function VacanciesList() {
  const t = useT();
  const [q, setQ] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["vacancies-list"],
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacancies")
        .select("id, title, area, seniority, status, public_slug, public_host, created_at, applications:applications(count)")
        .order("created_at", { ascending: false })
        .abortSignal(AbortSignal.timeout(15000));
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  // Portales de vacantes: el de la organización actual (si tiene subdominio activo) y,
  // para admins de la plataforma, los portales de organizaciones con portal propio.
  const { data: portal } = useQuery({
    queryKey: ["vacancies-share-portal"],
    retry: 1,
    queryFn: async () => {
      const toPortal = (o: any) => ({ name: String(o.name ?? ""), url: `https://${o.subdomain}.${MAIN_APP_HOST}/vacantes` });
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof?.org_id) return [];
      const { data: org } = await supabase
        .from("organizations")
        .select("name, subdomain, custom_features")
        .eq("id", prof.org_id)
        .maybeSingle();
      const own = (org as any)?.custom_features?.subdomain === true && (org as any)?.subdomain ? [toPortal(org)] : [];
      if (own.length) return own;
      const { data: user } = await supabase.auth.getUser();
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user?.user?.id ?? "", _role: "admin" });
      if (!isAdmin) return [];
      const { data: orgs } = await supabase
        .from("organizations")
        .select("name, subdomain, custom_features")
        .not("subdomain", "is", null)
        .limit(50);
      return (orgs ?? [])
        .filter((o: any) => o.custom_features?.subdomain === true && o.subdomain)
        .map(toPortal);
    },
  });

  function copyShare(url: string, id: string | null) {
    navigator.clipboard.writeText(url).then(
      () => {
        if (id === "portal") setCopiedUrl(url);
        else setCopiedId(id);
        toast.success(t("Link copiado"));
        setTimeout(() => {
          setCopiedUrl(null);
          setCopiedId(null);
        }, 2000);
      },
      () => toast.error(t("No pudimos copiar el link. Copialo manualmente: " + url)),
    );
  }


  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((v: any) =>
      [v.title, v.area, v.seniority, v.status].filter(Boolean).some((s: string) => String(s).toLowerCase().includes(term))
    );
  }, [data, q]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-10">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">{t("Vacantes")}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t("Gestioná tus búsquedas abiertas.")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!data?.length}
            onClick={() => {
              const rows = (filtered ?? []).map((v: any) => [v.title, v.status, v.applications?.[0]?.count ?? 0]);
              downloadCSV("vacantes", [t("Vacante"), t("Estado"), t("Postulantes")], rows);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 sm:px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">{t("Exportar Excel")}</span><span className="sm:hidden">{t("Excel")}</span>
          </button>
          <Link data-tour="new-vacancy" to="/app/vacancies/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-3 sm:px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t("Nueva vacante")}</span><span className="sm:hidden">{t("Nueva")}</span>
          </Link>
        </div>
      </header>

      <div className="mb-4"><PromoNotice /></div>

      <div className="mb-4"><UsageCard /></div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("Compartí tus vacantes con los postulantes")}</p>
            {portal && portal.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2">
                {(portal as { name: string; url: string }[]).map((p) => (
                  <div key={p.url} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {portal.length > 1 && (
                      <span className="shrink-0 text-xs font-medium text-muted-foreground sm:w-28 sm:truncate">{p.name}</span>
                    )}
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{p.url}</code>
                    <button
                      type="button"
                      onClick={() => copyShare(p.url, "portal")}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      {copiedUrl === p.url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedUrl === p.url ? t("¡Copiado!") : t("Copiar link del portal")}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Usá el botón de copiar junto a cada vacante activa para compartir su formulario de postulación.")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 relative max-w-md">

        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t("Buscar por título, área, estado…")}
          className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {isLoading && <div className="p-10 text-center text-muted-foreground">{t("Cargando…")}</div>}
        {isError && (
          <div className="p-10 text-center">
            <p className="text-sm text-destructive">{t("No pudimos cargar tus vacantes.")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{(error as Error)?.message}</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {isFetching ? t("Cargando…") : t("Reintentar")}
            </button>
          </div>
        )}
        {!isLoading && !isError && !data?.length && (

          <div className="p-12 text-center">
            <p className="text-muted-foreground">{t("No tenés vacantes todavía.")}</p>
            <Link to="/app/vacancies/new" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <Plus className="h-4 w-4" /> {t("Crear la primera")}
            </Link>
          </div>
        )}
        {!isLoading && data?.length && !filtered.length && (
          <div className="p-10 text-center text-sm text-muted-foreground">{t('Sin resultados para "{q}".', { q })}</div>
        )}
        {filtered?.map((v: any) => {
          const isActive = v.status === "active";
          const label = isActive ? t("Activa") : v.status === "paused" ? t("Desactivada") : v.status === "closed" ? t("Cerrada") : t("Borrador");
          const badgeCls = isActive
            ? "bg-emerald-100 text-emerald-700"
            : v.status === "paused"
            ? "bg-red-100 text-red-700"
            : "bg-muted text-muted-foreground";
          return (
            <Link key={v.id} to="/app/vacancies/$vacancyId" params={{ vacancyId: v.id }}
              className="flex flex-col gap-3 border-b border-border p-4 last:border-0 hover:bg-accent/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{v.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badgeCls}`}>{label}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {v.area ?? "—"} · {v.seniority ?? "—"} · <span className="font-semibold text-foreground">{v.applications?.[0]?.count ?? 0}</span> {t("postulantes")}
                </div>
              </div>
              {isActive && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      copyShare(vacancyPublicUrl(v), v.id);
                    }}
                    className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {copiedId === v.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedId === v.id ? t("¡Copiado!") : t("Copiar link")}
                  </button>
                  <a
                    href={vacancyPublicUrl(v)}
                    target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-background"
                  >
                    <ExternalLink className="h-3 w-3" /> {t("Ver")}
                  </a>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

