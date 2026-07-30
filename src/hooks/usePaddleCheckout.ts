import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const openCheckout = async (options: {
    priceId: string;
    quantity?: number;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);

      // Paddle only accepts successUrl on domains approved in the account.
      // Preview/ephemeral domains aren't approved, so we fall back to the
      // account's default payment link there instead of erroring out.
      const origin = window.location.origin;
      const approvedOrigin = /(^https:\/\/(www\.)?fluxtalent\.com\.ar$)|(^https:\/\/fluxtalent\.lovable\.app$)/.test(origin);
      const successUrl = options.successUrl ?? (approvedOrigin ? `${origin}/app/subscription?checkout=success` : undefined);

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: options.quantity ?? 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        eventCallback: (ev: any) => {
          if (ev?.name === "checkout.completed") {
            toast.success("¡Pago confirmado! Estamos activando tu plan…");
            // El webhook activa la org; refrescamos unas veces hasta verlo.
            [1500, 4000, 8000, 15000].forEach(ms =>
              setTimeout(() => {
                qc.invalidateQueries({ queryKey: ["my-subscription"] });
                qc.invalidateQueries({ queryKey: ["usage-summary"] });
              }, ms),
            );
          }
        },
        settings: {
          displayMode: "overlay",
          ...(successUrl ? { successUrl } : {}),
          allowLogout: false,
          variant: "one-page",
        },
      });

    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
