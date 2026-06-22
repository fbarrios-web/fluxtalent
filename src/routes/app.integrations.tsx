import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Check, Loader2, AlertCircle, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { getGoogleStatus, googleStartUrl, googleDisconnect, verifyGoogleOAuthConfig } from "@/lib/scheduling.functions";

const GOOGLE_CALLBACK_URL = "https://fluxtalent.lovable.app/api/public/google/callback";

export const Route = createFileRoute("/app/integrations")({
  component: IntegrationsPage,
  validateSearch: (s: Record<string, unknown>) => ({
    ok: typeof s.ok === "string" ? s.ok : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  head: () => ({ meta: [{ title: "Integraciones — FLUX Talent" }] }),
});

function IntegrationsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const search = Route.useSearch();

  useEffect(() => {
    if (search.ok === "1") {
      toast.success("Google Calendar conectado");
      router.navigate({ to: "/app/integrations", replace: true });
      qc.invalidateQueries({ queryKey: ["google-status"] });
    } else if (search.error) {
      toast.error(`No se pudo conectar: ${search.error}`);
      router.navigate({ to: "/app/integrations", replace: true });
    }
  }, [search.ok, search.error, qc, router]);

  return (
    <div className="p-6 md:p-10 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">Integraciones</h1>
      <p className="text-muted-foreground mb-8">Conectá tu cuenta para automatizar entrevistas con Meet y enviar invitaciones desde tu mail.</p>
      <IntegrationsPanel />
    </div>
  );
}

/** Embeddable panel — used both at /app/integrations and inside /app/settings as a tab. */
export function IntegrationsPanel() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getGoogleStatus);
  const startUrl = useServerFn(googleStartUrl);
  const verifyOAuth = useServerFn(verifyGoogleOAuthConfig);
  const disconnect = useServerFn(googleDisconnect);

  const { data, isLoading } = useQuery({
    queryKey: ["google-status"],
    queryFn: () => getStatus(),
  });

  const { data: oauthCheck, isLoading: isVerifying } = useQuery({
    queryKey: ["google-oauth-check"],
    queryFn: () => verifyOAuth({ data: { origin: window.location.origin } }),
  });

  async function connect() {
    try {
      const result = await startUrl({ data: { origin: window.location.origin } });
      if (!result.ok) {
        toast.error("Google rechazó el callback configurado. Revisá la verificación OAuth.");
        qc.invalidateQueries({ queryKey: ["google-oauth-check"] });
        return;
      }
      window.location.href = result.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Error al iniciar conexión");
    }
  }

  async function onDisconnect() {
    await disconnect();
    toast.success("Cuenta desconectada");
    qc.invalidateQueries({ queryKey: ["google-status"] });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold">Google Calendar + Gmail</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Cada entrevista agenda un evento en tu Calendar, genera el link de Meet automáticamente y envía la invitación desde tu mail.
          </p>

          {isLoading ? (
            <div className="mt-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : data?.connected ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                Conectado como <strong>{data.email}</strong>
              </div>
              <Button variant="outline" size="sm" onClick={onDisconnect}>Desconectar</Button>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={connect}>Conectar Google</Button>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Pediremos permisos para crear eventos en Calendar y enviar mails con tu cuenta.
              </p>
              <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Callback autorizado requerido en Google: <span className="font-mono text-foreground">{GOOGLE_CALLBACK_URL}</span>
              </p>
              <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-xs">
                {isVerifying ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verificando OAuth con Google...
                  </div>
                ) : oauthCheck?.ok ? (
                  <div className="space-y-2">
                    {oauthCheck.verificationStatus === "requires_manual_check" ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-3 w-3" /> Google no permite verificar esto desde servidor; si al conectar falla, falta autorizar este callback.
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="h-3 w-3" /> OAuth preparado para este callback.
                      </div>
                    )}
                    <p className="font-mono text-muted-foreground break-all">{oauthCheck.callbackUri}</p>
                    <p className="text-muted-foreground">
                      Client ID: <span className="font-mono text-foreground break-all">{oauthCheck.diagnostics?.clientId ?? "No configurado"}</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-3 w-3" /> Google todavía bloquea el callback autorizado.
                    </div>
                    <p className="text-muted-foreground">
                      Client ID usado: <span className="font-mono text-foreground break-all">{oauthCheck?.diagnostics?.clientId ?? "No configurado"}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Estado de credenciales: <span className="font-mono text-foreground">{oauthCheck?.credentials?.status ?? "sin verificar"}</span>
                    </p>
                    <div className="space-y-1 text-muted-foreground">
                      {(oauthCheck?.requiredCallbackUris ?? [GOOGLE_CALLBACK_URL]).map((uri) => (
                        <p key={uri} className="font-mono text-foreground break-all">{uri}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
