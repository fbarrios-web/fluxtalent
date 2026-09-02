import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IMPERSONATION_KEY, IMPERSONATION_PENDING_KEY, type ImpersonationPendingState } from "@/components/impersonation-banner";

export const Route = createFileRoute("/auth/impersonate")({
  validateSearch: (search: Record<string, unknown>) => ({
    token_hash: typeof search.token_hash === "string" ? search.token_hash : "",
  }),
  component: ImpersonateCallback,
  head: () => ({
    meta: [
      { title: "Acceso temporal — FLUX Talent" },
      { name: "description", content: "Acceso temporal seguro a una cuenta de FLUX Talent." },
      { property: "og:title", content: "Acceso temporal — FLUX Talent" },
      { property: "og:description", content: "Acceso temporal seguro a una cuenta de FLUX Talent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ImpersonateCallback() {
  const nav = useNavigate();
  const { token_hash } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const enter = async () => {
      let pending: ImpersonationPendingState | null = null;
      try {
        const raw = sessionStorage.getItem(IMPERSONATION_PENDING_KEY);
        pending = raw ? (JSON.parse(raw) as ImpersonationPendingState) : null;
        if (!pending?.admin_access_token || !pending.admin_refresh_token || !pending.label || !token_hash) {
          throw new Error("El acceso temporal no es válido o ya venció.");
        }

        const { data, error: verifyError } = await supabase.auth.verifyOtp({ token_hash, type: "email" });
        if (verifyError) throw verifyError;
        if (!data.session) throw new Error("No se pudo iniciar la sesión temporal.");

        sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify({
          label: pending.label,
          admin_access_token: pending.admin_access_token,
          admin_refresh_token: pending.admin_refresh_token,
        }));
        sessionStorage.removeItem(IMPERSONATION_PENDING_KEY);
        if (active) nav({ to: "/app/dashboard", replace: true });
      } catch (cause: any) {
        sessionStorage.removeItem(IMPERSONATION_PENDING_KEY);
        if (active) setError(cause?.message ?? "No se pudo ingresar a la cuenta.");
      }
    };
    void enter();
    return () => { active = false; };
  }, [nav, token_hash]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-foreground">No se pudo ingresar</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => nav({ to: "/app/admin/orgs", replace: true })}>Volver a Organizaciones</Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Ingresando a la cuenta…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Preparando el panel completo.</p>
          </>
        )}
      </div>
    </main>
  );
}
