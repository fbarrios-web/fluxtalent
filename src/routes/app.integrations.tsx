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
import { GoogleSetupGuide } from "@/components/google-setup-guide";
import { useT } from "@/lib/i18n";

const MICROSOFT_CALLBACK_URL = "https://fluxtalent.lovable.app/api/public/microsoft/callback";

export const Route = createFileRoute("/app/integrations")({
  component: IntegrationsPage,
  validateSearch: (s: Record<string, unknown>): { ok?: string; ok_ms?: string; error?: string } => ({
    ok: typeof s.ok === "string" ? s.ok : undefined,
    ok_ms: typeof s.ok_ms === "string" ? s.ok_ms : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  head: () => ({ meta: [{ title: "Integraciones — FLUX Talent" }] }),
});

function IntegrationsPage() {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const search = Route.useSearch();

  useEffect(() => {
    if (search.ok === "1") {
      toast.success(t("Google Calendar conectado"));
      router.navigate({ to: "/app/integrations", replace: true });
      qc.invalidateQueries({ queryKey: ["google-status"] });
      qc.invalidateQueries({ queryKey: ["microsoft-status"] });
    } else if (search.ok_ms === "1") {
      toast.success(t("Microsoft (Outlook + Teams) conectado"));
      router.navigate({ to: "/app/integrations", replace: true });
      qc.invalidateQueries({ queryKey: ["google-status"] });
      qc.invalidateQueries({ queryKey: ["microsoft-status"] });
    } else if (search.error) {
      const messages: Record<string, string> = {
        invalid_microsoft_secret: t("Microsoft rechazó el secreto configurado. Ya lo actualicé; probá conectar de nuevo."),
        microsoft_token_exchange_failed: t("Microsoft no pudo completar la conexión. Probá conectar de nuevo."),
        microsoft_profile_failed: t("Microsoft conectó, pero no pudimos leer el perfil. Revisá permisos y reconectá."),
        no_refresh: t("Microsoft no devolvió acceso permanente. Reconectá aceptando todos los permisos."),
        invalid_state: t("La conexión expiró. Iniciá Microsoft nuevamente."),
        missing_code: t("Microsoft canceló la conexión antes de terminar."),
        store_failed: t("No pudimos guardar la conexión. Probá nuevamente."),
      };
      toast.error(messages[search.error] ?? t("No se pudo conectar: {error}", { error: search.error }));
      router.navigate({ to: "/app/integrations", replace: true });
    }
  }, [search.ok, search.ok_ms, search.error, qc, router]);

  return (
    <div className="p-6 md:p-10 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">{t("Integraciones")}</h1>
        <p className="text-muted-foreground">{t("Conectá tu cuenta para automatizar entrevistas y enviar invitaciones desde tu mail. Solo podés tener un proveedor activo a la vez.")}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t("¿Preferís no integrar? Podés seguir usando el sistema, pero")} <strong>{t("no se envían las comunicaciones automáticas")}</strong> {t("ni se crean los eventos con link de videollamada.")}
        </p>
      </div>
      <GoogleSetupGuide defaultOpen />
      <IntegrationsPanel />
      <MicrosoftPanel callbackUrl={MICROSOFT_CALLBACK_URL} />
    </div>
  );
}

export function MicrosoftPanel({ callbackUrl: _callbackUrl }: { callbackUrl?: string }) {
  const t = useT();
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
        toast.error(t("Microsoft OAuth no está configurado o el redirect no coincide."));
        return;
      }
      window.location.href = result.url;
    } catch (e: any) {
      toast.error(e?.message ?? t("Error al iniciar conexión"));
    }
  }

  async function onDisconnect() {
    await disconnect();
    toast.success(t("Microsoft desconectado"));
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
            <h2 className="font-semibold">{t("Microsoft 365 — Outlook + Teams")}</h2>
            {!isLoading && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${data?.connected ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {data?.connected ? t("Conectado") : t("Desconectado")}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Enviá mails desde tu Outlook y creá reuniones de Teams automáticamente cuando agendes una entrevista.")}
          </p>
          <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>{t("Solo cuentas empresariales o educativas")}</strong> {t("(Microsoft 365 Business / Education con buzón Exchange Online activo).")}
              {t("Las cuentas personales (@outlook.com, @hotmail.com, @live.com) no pueden crear reuniones de Teams ni enviar mails vía Graph API — es una limitación de Microsoft, no de FLUX Talent. Si tenés una cuenta personal, usá la integración con Google.")}
            </span>
          </div>

          {isLoading ? (
            <div className="mt-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : data?.connected ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                {t("Conectado como")} <strong>{data.email}</strong>
              </div>
              {(!data.hasMailScope || !data.hasCalendarScope || !data.hasTeamsScope) && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-3 w-3" />
                    {t("Permisos incompletos. Reconectá Microsoft para autorizar:")}
                  </div>
                  <ul className="list-disc pl-5">
                    {!data.hasMailScope && <li>{t("Enviar mails desde Outlook")}</li>}
                    {!data.hasCalendarScope && <li>{t("Crear eventos en Calendario")}</li>}
                    {!data.hasTeamsScope && <li>{t("Crear reuniones de Teams")}</li>}
                  </ul>
                  <Button size="sm" onClick={connect}>{t("Reconectar Microsoft")}</Button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={onDisconnect}>{t("Desconectar")}</Button>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={connect}>{t("Conectar Microsoft")}</Button>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t("Al conectar Microsoft se desactiva Google para mantener un solo proveedor activo.")}
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
  const t = useT();
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
        toast.error(t("Google rechazó el callback configurado. Contactá soporte."));
        return;
      }
      window.location.href = result.url;
    } catch (e: any) {
      toast.error(e?.message ?? t("Error al iniciar conexión"));
    }
  }

  async function onDisconnect() {
    await disconnect();
    toast.success(t("Cuenta desconectada"));
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
            <h2 className="font-semibold">{t("Google Calendar + Gmail")}</h2>
            {!isLoading && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${data?.connected ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {data?.connected ? t("Conectado") : t("Desconectado")}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Cada entrevista agenda un evento en tu Calendar, genera el link de Meet automáticamente y envía la invitación desde tu mail.")}
          </p>

          {isLoading ? (
            <div className="mt-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : data?.connected ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                {t("Conectado como")} <strong>{data.email}</strong>
              </div>
              {(!data.hasGmailScope || !data.hasCalendarScope) && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-3 w-3" />
                    {t("Permisos incompletos. Reconectá Google para autorizar:")}
                  </div>
                  <ul className="list-disc pl-5">
                    {!data.hasCalendarScope && <li>{t("Crear eventos en Calendar")}</li>}
                    {!data.hasGmailScope && <li>{t("Enviar mails desde tu cuenta (gmail.send)")}</li>}
                  </ul>
                  <Button size="sm" onClick={connect}>{t("Reconectar Google")}</Button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={onDisconnect}>{t("Desconectar")}</Button>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={connect}>{t("Conectar Google")}</Button>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t("Al conectar Google se desactiva Microsoft para mantener un solo proveedor activo.")}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
