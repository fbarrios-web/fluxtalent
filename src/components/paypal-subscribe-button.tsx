import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PAYPAL_CLIENT_ID, PAYPAL_PLAN_IDS, type PaypalPlanId } from "@/lib/paypal";
import { activatePaypalSubscription } from "@/lib/paypal.functions";
import { useT } from "@/lib/i18n";

let sdkPromise: Promise<void> | null = null;

function loadPaypalSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).paypal) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
    s.async = true;
    s.setAttribute("data-sdk-integration-source", "button-factory");
    s.onload = () => resolve();
    s.onerror = () => { sdkPromise = null; reject(new Error("PayPal SDK")); };
    document.body.appendChild(s);
  });
  return sdkPromise;
}

export function PaypalSubscribeButton({ planId, onSuccess }: { planId: PaypalPlanId; onSuccess?: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const activate = useServerFn(activatePaypalSubscription);
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "processing">("loading");
  const paypalPlanId = PAYPAL_PLAN_IDS[planId];

  useEffect(() => {
    let cancelled = false;
    if (!paypalPlanId) return;
    loadPaypalSdk()
      .then(() => {
        if (cancelled || !ref.current) return;
        const paypal = (window as any).paypal;
        if (!paypal?.Buttons) { setStatus("error"); return; }
        ref.current.innerHTML = "";
        paypal
          .Buttons({
            style: { shape: "rect", color: "blue", layout: "horizontal", label: "subscribe", height: 40 },
            createSubscription: (_d: any, actions: any) =>
              actions.subscription.create({ plan_id: paypalPlanId, quantity: 1 }),
            onApprove: async (data: any) => {
              setStatus("processing");
              try {
                await activate({ data: { subscriptionId: data.subscriptionID, planId } });
                await qc.invalidateQueries({ queryKey: ["my-subscription"] });
                await qc.invalidateQueries({ queryKey: ["setup-me"] });
                toast.success(t("¡Suscripción activada! Ya podés usar tu plan."));
                onSuccess?.();
              } catch (e: any) {
                toast.error(e?.message ?? t("No pudimos activar tu suscripción. Escribinos a soporte@fluxtalent.com.ar."));
              } finally {
                setStatus("ready");
              }
            },
            onError: (err: any) => {
              console.error("[paypal] checkout error", err);
              toast.error(t("PayPal no pudo procesar el pago. Probá con otra tarjeta o iniciando sesión en tu cuenta de PayPal."));
            },
          })
          .render(ref.current)
          .then(() => { if (!cancelled) setStatus("ready"); })
          .catch(() => { if (!cancelled) setStatus("error"); });
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [paypalPlanId, planId]);

  if (!paypalPlanId) return null;

  return (
    <div className="mt-4">
      <div ref={ref} className="min-h-[42px]" />
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("Cargando PayPal…")}
        </div>
      )}
      {status === "processing" && (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("Activando tu plan…")}
        </div>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive">{t("No pudimos cargar PayPal. Recargá la página o escribinos a soporte@fluxtalent.com.ar.")}</p>
      )}
    </div>
  );
}
