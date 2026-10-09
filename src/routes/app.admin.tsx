import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAmI } from "@/lib/admin.functions";
import { Loader2, BarChart3, Building2, Users, CreditCard, ShieldAlert, Tag, Activity, Smile, Globe, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — FLUX Talent" }] }),
});

function AdminLayout() {
  const t = useT();
  const tabs = [
    { to: "/app/admin", label: t("Métricas"), icon: BarChart3, exact: true },
    { to: "/app/admin/orgs", label: t("Organizaciones"), icon: Building2 },
    { to: "/app/admin/users", label: t("Usuarios"), icon: Users },
    { to: "/app/admin/payments", label: t("Pagos"), icon: CreditCard },
    { to: "/app/admin/pricing", label: t("Precios"), icon: Tag },
    { to: "/app/admin/traffic", label: t("Tráfico"), icon: Globe },
    { to: "/app/admin/usage", label: t("Consumo"), icon: Activity },
    { to: "/app/admin/surveys", label: t("Encuestas"), icon: Smile },
    { to: "/app/admin/demos", label: t("Demos"), icon: CalendarDays },
  ];
  const fn = useServerFn(adminAmI);
  const { data, isLoading } = useQuery({ queryKey: ["am-i-admin"], queryFn: () => fn() });
  const loc = useLocation();

  if (isLoading) return <div className="grid h-96 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!data?.isAdmin) return (
    <div className="grid h-96 place-items-center p-6 text-center">
      <div>
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 font-display text-2xl">{t("Acceso restringido")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("Esta sección es exclusiva para administradores de la plataforma.")}</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-10">
      <header className="mb-4 md:mb-6">
        <p className="text-xs uppercase tracking-wider text-primary">{t("Panel de administración")}</p>
        <h1 className="font-display text-2xl md:text-4xl">FLUX Talent · {t("Operaciones")}</h1>
      </header>

      <nav className="mb-6 -mx-4 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-1 md:w-auto">
          {tabs.map(tb => {
            const active = tb.exact ? loc.pathname === tb.to : loc.pathname.startsWith(tb.to);
            return (
              <Link key={tb.to} to={tb.to} className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium -mb-px md:px-4",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
                <tb.icon className="h-4 w-4 shrink-0" /> {tb.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
