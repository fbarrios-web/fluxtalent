import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

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
