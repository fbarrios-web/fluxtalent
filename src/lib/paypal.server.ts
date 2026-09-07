// Helpers server-only para hablar con la API REST de PayPal.

const API_BASE = process.env.PAYPAL_ENV === "sandbox"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function accessToken(): Promise<string | null> {
  if (!paypalConfigured()) return null;
  const basic = btoa(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.error("[paypal] token failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json: any = await res.json();
  return json.access_token ?? null;
}

export async function paypalFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const token = await accessToken();
  if (!token) return null;
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Devuelve la suscripción de PayPal, o null si no pudimos consultarla. */
export async function getPaypalSubscription(subscriptionId: string): Promise<any | null> {
  const res = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (!res || !res.ok) return null;
  return res.json();
}

/** Cancela la suscripción de PayPal. Devuelve true si PayPal la aceptó. */
export async function cancelPaypalSubscription(subscriptionId: string, reason = "Cancelada por el usuario"): Promise<boolean> {
  const res = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return Boolean(res && (res.ok || res.status === 204));
}

/** Verifica la firma de un webhook de PayPal (requiere PAYPAL_WEBHOOK_ID). */
export async function verifyPaypalWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId || !paypalConfigured()) return false;
  const res = await paypalFetch("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!res || !res.ok) return false;
  const json: any = await res.json();
  return json.verification_status === "SUCCESS";
}
