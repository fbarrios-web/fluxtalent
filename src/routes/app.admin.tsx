import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAmI } from "@/lib/admin.functions";
import { Loader2, BarChart3, Building2, Users, CreditCard, ShieldAlert, Tag, Activity, Smile } from "lucide-react";
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
    { to: "/app/admin/usage", label: t("Consumo"), icon: Activity },
    { to: "/app/admin/surveys", label: t("Encuestas"), icon: Smile },
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
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary">{t("Panel de administración")}</p>
          <h1 className="font-display text-4xl">FLUX Talent · {t("Operaciones")}</h1>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 border-b border-border">
        {tabs.map(tb => {
          const active = tb.exact ? loc.pathname === tb.to : loc.pathname.startsWith(tb.to);
          return (
            <Link key={tb.to} to={tb.to} className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium -mb-px",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
              <tb.icon className="h-4 w-4" /> {tb.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
