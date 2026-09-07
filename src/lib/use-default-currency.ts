import { useEffect, useState } from "react";

export type Currency = "ars" | "usd";

let cached: Currency | null = null;

/**
 * Defaults to USD (PayPal) when the visitor is outside Argentina.
 */
export function useDefaultCurrency() {
  const [currency, setCurrency] = useState<Currency>(cached ?? "ars");

  useEffect(() => {
    if (cached) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/public/geo", { headers: { accept: "application/json" } });
        const json = (await res.json()) as { country?: string | null };
        const country = (json?.country || "").toUpperCase();
        const next: Currency = country && country !== "AR" ? "usd" : "ars";
        cached = next;
        if (active) setCurrency(next);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return [currency, setCurrency] as const;
}
