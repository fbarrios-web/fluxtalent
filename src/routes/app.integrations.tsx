import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Check, Loader2, AlertCircle, Video } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { getGoogleStatus, googleStartUrl, googleDisconnect } from "@/lib/scheduling.functions";
import { getMicrosoftStatus, microsoftStartUrl, microsoftDisconnect } from "@/lib/microsoft.functions";

const MICROSOFT_CALLBACK_URL = "https://fluxtalent.lovable.app/api/public/microsoft/callback";

export const Route = createFileRoute("/app/integrations")({
  component: IntegrationsPage,
  validateSearch: (s: Record<string, unknown>) => ({
    ok: typeof s.ok === "string" ? s.ok : undefined,
    ok_ms: typeof s.ok_ms === "string" ? s.ok_ms : undefined,
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
      qc.invalidateQueries({ queryKey: ["microsoft-status"] });
    } else if (search.ok_ms === "1") {
      toast.success("Microsoft (Outlook + Teams) conectado");
      router.navigate({ to: "/app/integrations", replace: true });
      qc.invalidateQueries({ queryKey: ["google-status"] });
      qc.invalidateQueries({ queryKey: ["microsoft-status"] });
    } else if (search.error) {
      const messages: Record<string, string> = {
        invalid_microsoft_secret: "Microsoft rechazó el secreto configurado. Ya lo actualicé; probá conectar de nuevo.",
        microsoft_token_exchange_failed: "Microsoft no pudo completar la conexión. Probá conectar de nuevo.",
        microsoft_profile_failed: "Microsoft conectó, pero no pudimos leer el perfil. Revisá permisos y reconectá.",
        no_refresh: "Microsoft no devolvió acceso permanente. Reconectá aceptando todos los permisos.",
        invalid_state: "La conexión expiró. Iniciá Microsoft nuevamente.",
        missing_code: "Microsoft canceló la conexión antes de terminar.",
        store_failed: "No pudimos guardar la conexión. Probá nuevamente.",
      };
      toast.error(messages[search.error] ?? `No se pudo conectar: ${search.error}`);
      router.navigate({ to: "/app/integrations", replace: true });
    }
  }, [search.ok, search.ok_ms, search.error, qc, router]);

  return (
    <div className="p-6 md:p-10 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Integraciones</h1>
        <p className="text-muted-foreground">Conectá tu cuenta para automatizar entrevistas y enviar invitaciones desde tu mail. Solo podés tener un proveedor activo a la vez.</p>
      </div>
      <IntegrationsPanel />
      <MicrosoftPanel callbackUrl={MICROSOFT_CALLBACK_URL} />
    </div>
  );
}

export function MicrosoftPanel({ callbackUrl: _callbackUrl }: { callbackUrl?: string }) {
  const qc = useQueryClient();
  const getStatus = useServerFn(getMicrosoftStatus);
  const startUrl = useServerFn(microsoftStartUrl);
  const disconnect = useServerFn(microsoftDisconnect);

  const { data, isLoading } = useQuery({
    queryKey: ["microsoft-status"],
    queryFn: () => getStatus(),
  });

  async function connect() {
    try {
      const result = await startUrl({ data: { origin: window.location.origin } });
      if (!result.ok) {
        toast.error("Microsoft OAuth no está configurado o el redirect no coincide.");
        return;
      }
      window.location.href = result.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Error al iniciar conexión");
    }
  }

  async function onDisconnect() {
    await disconnect();
    toast.success("Microsoft desconectado");
    qc.invalidateQueries({ queryKey: ["google-status"] });
    qc.invalidateQueries({ queryKey: ["microsoft-status"] });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Video className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Microsoft 365 — Outlook + Teams</h2>
            {!isLoading && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${data?.connected ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {data?.connected ? "Conectado" : "Desconectado"}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Enviá mails desde tu Outlook y creá reuniones de Teams automáticamente cuando agendes una entrevista.
          </p>

          {isLoading ? (
            <div className="mt-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : data?.connected ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                Conectado como <strong>{data.email}</strong>
              </div>
              {(!data.hasMailScope || !data.hasCalendarScope || !data.hasTeamsScope) && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-3 w-3" />
                    Permisos incompletos. Reconectá Microsoft para autorizar:
                  </div>
                  <ul className="list-disc pl-5">
                    {!data.hasMailScope && <li>Enviar mails desde Outlook</li>}
                    {!data.hasCalendarScope && <li>Crear eventos en Calendario</li>}
                    {!data.hasTeamsScope && <li>Crear reuniones de Teams</li>}
                  </ul>
                  <Button size="sm" onClick={connect}>Reconectar Microsoft</Button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={onDisconnect}>Desconectar</Button>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={connect}>Conectar Microsoft</Button>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Al conectar Microsoft se desactiva Google para mantener un solo proveedor activo.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Embeddable panel — used both at /app/integrations and inside /app/settings as a tab. */
export function IntegrationsPanel() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getGoogleStatus);
  const startUrl = useServerFn(googleStartUrl);
  const disconnect = useServerFn(googleDisconnect);

  const { data, isLoading } = useQuery({
    queryKey: ["google-status"],
    queryFn: () => getStatus(),
  });

  async function connect() {
    try {
      const result = await startUrl({ data: { origin: window.location.origin } });
      if (!result.ok) {
        toast.error("Google rechazó el callback configurado. Contactá soporte.");
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
    qc.invalidateQueries({ queryKey: ["microsoft-status"] });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Google Calendar + Gmail</h2>
            {!isLoading && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${data?.connected ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {data?.connected ? "Conectado" : "Desconectado"}
              </span>
            )}
          </div>
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
              {(!data.hasGmailScope || !data.hasCalendarScope) && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-3 w-3" />
                    Permisos incompletos. Reconectá Google para autorizar:
                  </div>
                  <ul className="list-disc pl-5">
                    {!data.hasCalendarScope && <li>Crear eventos en Calendar</li>}
                    {!data.hasGmailScope && <li>Enviar mails desde tu cuenta (gmail.send)</li>}
                  </ul>
                  <Button size="sm" onClick={connect}>Reconectar Google</Button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={onDisconnect}>Desconectar</Button>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={connect}>Conectar Google</Button>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Al conectar Google se desactiva Microsoft para mantener un solo proveedor activo.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
