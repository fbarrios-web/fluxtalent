import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAmI } from "@/lib/admin.functions";
import { Loader2, BarChart3, Building2, Users, CreditCard, ShieldAlert, Tag, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — FLUX Talent" }] }),
});

const tabs = [
  { to: "/app/admin", label: "Métricas", icon: BarChart3, exact: true },
  { to: "/app/admin/orgs", label: "Organizaciones", icon: Building2 },
  { to: "/app/admin/users", label: "Usuarios", icon: Users },
  { to: "/app/admin/payments", label: "Pagos", icon: CreditCard },
  { to: "/app/admin/pricing", label: "Precios", icon: Tag },
  { to: "/app/admin/usage", label: "Consumo", icon: Activity },
];

function AdminLayout() {
  const fn = useServerFn(adminAmI);
  const { data, isLoading } = useQuery({ queryKey: ["am-i-admin"], queryFn: () => fn() });
  const loc = useLocation();

  if (isLoading) return <div className="grid h-96 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!data?.isAdmin) return (
    <div className="grid h-96 place-items-center p-6 text-center">
      <div>
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 font-display text-2xl">Acceso restringido</h1>
        <p className="mt-1 text-sm text-muted-foreground">Esta sección es exclusiva para administradores de la plataforma.</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary">Panel de administración</p>
          <h1 className="font-display text-4xl">FLUX Talent · Operaciones</h1>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 border-b border-border">
        {tabs.map(t => {
          const active = t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to} className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium -mb-px",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
