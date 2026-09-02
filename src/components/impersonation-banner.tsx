import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserCog, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export const IMPERSONATION_KEY = "flux_impersonation";
export const IMPERSONATION_PENDING_KEY = "flux_impersonation_pending";

export type ImpersonationPendingState = {
  label: string;
  admin_access_token: string;
  admin_refresh_token: string;
};

export type ImpersonationState = ImpersonationPendingState;

export function readImpersonation(): ImpersonationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationState) : null;
  } catch {
    return null;
  }
}

export function ImpersonationBanner() {
  const t = useT();
  const [state, setState] = useState<ImpersonationState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(readImpersonation());
    const onStorage = () => setState(readImpersonation());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!state) return null;

  const back = async () => {
    setBusy(true);
    try {
      localStorage.removeItem(IMPERSONATION_KEY);
      await supabase.auth.setSession({
        access_token: state.admin_access_token,
        refresh_token: state.admin_refresh_token,
      });
      window.location.href = "/app/admin/orgs";
    } catch {
      setBusy(false);
      window.location.href = "/auth";
    }
  };

  return (
    <>
    <div className="h-14" aria-hidden />
    <div className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-3 border-t border-warning/40 bg-warning px-4 py-2.5 text-foreground shadow-lg">
      <span className="flex items-center gap-2 text-sm font-medium">
        <UserCog className="h-4 w-4" />
        {t("Estás en modo {name}", { name: state.label })}
      </span>
      <Button
        onClick={back}
        disabled={busy}
        size="sm"
        className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        {t("Volver al usuario admin")}
      </Button>
    </div>
    </>
  );
}
