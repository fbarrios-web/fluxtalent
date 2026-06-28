import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, signOut } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, Briefcase, Settings, LogOut, Loader2, CreditCard, ShieldCheck, Building2, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { FluxLogo } from "@/components/flux-logo";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { SatisfactionSurvey } from "@/components/satisfaction-survey";
import { adminAmI } from "@/lib/admin.functions";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const navItems = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/vacancies", label: "Vacantes", icon: Briefcase },
  { to: "/app/enterprise", label: "Multi-organización", icon: Building2 },
  { to: "/app/subscription", label: "Suscripción", icon: CreditCard },
  { to: "/app/settings", label: "Configuración", icon: Settings },
];


function AppLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const amI = useServerFn(adminAmI);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: roleData } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => amI(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const isAdmin = !!roleData?.isAdmin;

  const { data: profileCheck, refetch: refetchProfile } = useQuery({
    queryKey: ["profile-setup-check", user?.id],
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, dni, birth_date, country, province").eq("id", user!.id).maybeSingle();
      const d = data as any;
      const complete = !!d?.full_name && !!d?.dni && !!d?.birth_date && !!d?.country && !!d?.province;
      return { complete };
    },
  });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (user) refetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);

  useEffect(() => {
    if (!user || !profileCheck) return;
    if (!profileCheck.complete && !loc.pathname.startsWith("/app/setup") && !loc.pathname.startsWith("/app/settings")) {
      nav({ to: "/app/setup" });
    }
  }, [user, profileCheck, loc.pathname, nav]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }



  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {navItems.map(item => {
        const active = loc.pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
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
          onClick={onNavigate}
          className={cn(
            "mb-1 mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            loc.pathname.startsWith("/app/admin")
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}
        >
          <ShieldCheck className="h-4 w-4" /> Admin
        </Link>
      )}
    </>
  );

  return (
    <div className="grid min-h-screen bg-background md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-sidebar md:flex md:flex-col">
        <Link to="/app/dashboard" className="flex items-center gap-2 px-6 py-5 font-semibold text-sidebar-foreground">
          <FluxLogo size={32} />
          <span className="text-lg tracking-tight">FLUX <span className="text-muted-foreground font-normal">Talent</span></span>
        </Link>
        <nav className="flex-1 px-3 py-2"><NavLinks /></nav>
        <div className="border-t border-border p-3">
          <div className="mb-2 px-3 py-2 text-xs text-muted-foreground">
            <div className="truncate font-medium text-foreground">{user.email}</div>
          </div>
          <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex flex-col">
        <header className="flex items-center gap-3 bg-primary px-4 py-3 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button aria-label="Menú" className="flex items-center gap-2 rounded-lg border border-primary-foreground/30 bg-primary-foreground/10 px-3 py-2 text-primary-foreground hover:bg-primary-foreground/20 transition-colors">
                <Menu className="h-5 w-5" />
                <span className="text-xs font-medium">Menú</span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[260px] bg-sidebar p-0">
              <SheetTitle className="sr-only">Menú</SheetTitle>
              <div className="flex items-center gap-2 px-6 py-5 font-semibold text-sidebar-foreground">
                <FluxLogo size={28} />
                <span className="text-base tracking-tight">FLUX <span className="text-muted-foreground font-normal">Talent</span></span>
              </div>
              <nav className="px-3 py-2"><NavLinks onNavigate={() => setMobileOpen(false)} /></nav>
              <div className="border-t border-border p-3 mt-2">
                <div className="mb-2 px-3 py-2 text-xs text-muted-foreground">
                  <div className="truncate font-medium text-foreground">{user.email}</div>
                </div>
                <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent">
                  <LogOut className="h-4 w-4" /> Salir
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/app/dashboard" className="flex items-center gap-2 font-semibold text-primary-foreground">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-foreground p-1">
              <FluxLogo size={22} />
            </div>
            <span className="text-base tracking-tight">FLUX <span className="opacity-70 font-normal">Talent</span></span>
          </Link>
        </header>
        <SubscriptionBanner />
        <SatisfactionSurvey />
        <div className="flex-1"><Outlet /></div>
        <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
          © 2026 FLUX Automatizaciones. Todos los derechos reservados.
        </footer>
      </main>
    </div>
  );
}
