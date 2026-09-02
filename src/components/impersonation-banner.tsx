import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserCog, Loader2, LogOut } from "lucide-react";
import { useT } from "@/lib/i18n";

export const IMPERSONATION_KEY = "flux_impersonation";

export type ImpersonationState = {
  label: string;
  admin_access_token: string;
  admin_refresh_token: string;
};

export function readImpersonation(): ImpersonationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(IMPERSONATION_KEY);
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
    <div className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-3 border-t border-amber-500/40 bg-amber-500 px-4 py-2.5 text-amber-950 shadow-lg">
      <span className="flex items-center gap-2 text-sm font-medium">
        <UserCog className="h-4 w-4" />
        {t("Estás en modo {name}", { name: state.label })}
      </span>
      <button
        onClick={back}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-900 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        {t("Volver al usuario admin")}
      </button>
    </div>
  );
}
