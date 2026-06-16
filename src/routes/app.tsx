import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, signOut } from "@/lib/auth";
import { LayoutDashboard, Briefcase, Settings, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const navItems = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/vacancies", label: "Vacantes", icon: Briefcase },
  { to: "/app/settings", label: "Configuración", icon: Settings },
];

function AppLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

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
        <Link to="/app/dashboard" className="flex items-center gap-2 px-6 py-5 font-semibold">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">H</div>
          <span className="tracking-tight">FLUX Talent</span>
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

      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
