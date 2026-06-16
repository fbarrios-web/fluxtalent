import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, signOut } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, Briefcase, Settings, LogOut, Loader2, CreditCard, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { FluxLogo } from "@/components/flux-logo";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { adminAmI } from "@/lib/admin.functions";


export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const navItems = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/vacancies", label: "Vacantes", icon: Briefcase },
  { to: "/app/subscription", label: "Suscripción", icon: CreditCard },
  { to: "/app/settings", label: "Configuración", icon: Settings },
];


function AppLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const amI = useServerFn(adminAmI);
  const { data: roleData } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => amI(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const isAdmin = !!roleData?.isAdmin;

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }


  return (
    <div className="grid min-h-screen bg-background md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-sidebar md:flex md:flex-col">
        <Link to="/app/dashboard" className="flex items-center gap-2 px-6 py-5 font-semibold text-sidebar-foreground">
          <FluxLogo size={28} />
          <span className="tracking-tight">FLUX <span className="opacity-70 font-normal">Talent</span></span>
        </Link>

        <nav className="flex-1 px-3 py-2">
          {navItems.map(item => {
            const active = loc.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/app/admin"
              className={cn(
                "mb-1 mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                loc.pathname.startsWith("/app/admin")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 px-3 py-2 text-xs text-muted-foreground">
            <div className="truncate font-medium text-foreground">{user.email}</div>
          </div>
          <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex flex-col">
        <SubscriptionBanner />
        <div className="flex-1"><Outlet /></div>
        <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
          © 2026 FLUX Automatizaciones. Todos los derechos reservados.
        </footer>
      </main>


    </div>
  );
}
