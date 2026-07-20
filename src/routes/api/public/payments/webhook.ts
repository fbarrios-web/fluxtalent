import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, planFromPriceId, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

async function notifySupport(subject: string, body: string) {
  try {
    await fetch(`${process.env.SUPABASE_URL}`.replace(/\/$/, "") + "/functions/v1", { method: "GET" }).catch(() => {});
    // Enqueue transactional email to support via pgmq
    await getSupabase().rpc("enqueue_email", {
      queue_name: "q_transactional_emails",
      payload: {
        template: "invoice-request",
        to: "soporte@fluxtalent.com.ar",
        subject,
        data: { body },
      },
    });
  } catch (e) {
    console.error("notifySupport failed:", e);
  }
}

async function sendUserEmail(to: string, template: string, data: Record<string, any>) {
  try {
    await getSupabase().rpc("enqueue_email", {
      queue_name: "q_transactional_emails",
      payload: { template, to, data },
    });
  } catch (e) {
    console.error("sendUserEmail failed:", e);
  }
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;
  const userId: string | undefined = customData?.userId;
  const orgId: string | undefined = customData?.orgId;
  if (!userId || !orgId) {
    console.error("Missing userId/orgId in customData", customData);
    return;
  }

  const item = items[0];
  const priceId = item?.price?.importMeta?.externalId as string | undefined;
  const productId = item?.product?.importMeta?.externalId as string | undefined;
  if (!priceId || !productId) {
    console.warn("Skipping subscription: missing importMeta.externalId");
    return;
  }

  await getSupabase().from("subscriptions").upsert({
    org_id: orgId,
    user_id: userId,
    paddle_subscription_id: id,
    paddle_customer_id: customerId,
    product_id: productId,
    price_id: priceId,
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "paddle_subscription_id" });

  // Activate the plan on the organization
  const mapping = planFromPriceId(priceId);
  if (mapping) {
    await getSupabase().from("organizations").update({
      subscription_status: "active",
      plan_price_ars: mapping.priceArs,
      plan_currency: "usd",
      paddle_subscription_id: id,
      paddle_customer_id: customerId,
      current_period_end: currentBillingPeriod?.endsAt,
      last_payment_at: new Date().toISOString(),
      // Reset cycle counters
      new_vacancies_used: 0,
      cvs_used: 0,
    } as any).eq("id", orgId);
  }

  // Fetch user email + org name for notifications
  const { data: profile } = await getSupabase()
    .from("profiles").select("id, org_id, organizations(name)").eq("id", userId).maybeSingle();
  const { data: authUser } = await getSupabase().auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  const orgName = (profile as any)?.organizations?.name ?? "Organización";

  if (email) {
    await sendUserEmail(email, "subscription-confirmed", {
      plan: mapping?.plan ?? "premium",
      orgName,
    });
  }
  await notifySupport(
    `Nueva suscripción USD — ${mapping?.plan ?? "?"}`,
    `Org: ${orgName} (${orgId})\nUser: ${email ?? userId}\nPlan: ${mapping?.plan}\nSubscription: ${id}\nEnv: ${env}`,
  );
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data;
  const priceId = items?.[0]?.price?.importMeta?.externalId as string | undefined;
  const productId = items?.[0]?.product?.importMeta?.externalId as string | undefined;

  // Capture the previous price_id BEFORE updating so we can detect real plan changes
  const { data: prevRow } = await getSupabase()
    .from("subscriptions")
    .select("org_id, price_id")
    .eq("paddle_subscription_id", id)
    .eq("environment", env)
    .maybeSingle();

  const patch: Record<string, any> = {
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    cancel_at_period_end: scheduledChange?.action === "cancel",
    updated_at: new Date().toISOString(),
  };
  if (priceId) patch.price_id = priceId;
  if (productId) patch.product_id = productId;

  await getSupabase()
    .from("subscriptions")
    .update(patch)
    .eq("paddle_subscription_id", id)
    .eq("environment", env);

  // Sync plan tier on org (handles upgrades that took effect immediately).
  // Only reset counters when the plan actually CHANGED — not on renewals,
  // proration adjustments, or dunning transitions.
  if (prevRow?.org_id && priceId) {
    const mapping = planFromPriceId(priceId);
    if (mapping) {
      const planChanged = prevRow.price_id && prevRow.price_id !== priceId;
      const orgPatch: Record<string, any> = {
        plan_price_ars: mapping.priceArs,
        plan_currency: "usd",
        current_period_end: currentBillingPeriod?.endsAt,
        subscription_status: status === "past_due" ? "past_due" : "active",
      };
      if (planChanged) {
        orgPatch.new_vacancies_used = 0;
        orgPatch.cvs_used = 0;
      }
      await getSupabase().from("organizations").update(orgPatch).eq("id", prevRow.org_id);
    }
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const { id, currentBillingPeriod } = data;
  const { data: subRow } = await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      current_period_end: currentBillingPeriod?.endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env)
    .select("org_id")
    .maybeSingle();

  // Access is kept until current_period_end — mark org canceled but don't downgrade yet.
  if (subRow?.org_id) {
    await getSupabase().from("organizations").update({
      subscription_status: "canceled",
      current_period_end: currentBillingPeriod?.endsAt,
    } as any).eq("id", subRow.org_id);
  }
}

/** Records a successful Paddle transaction in the unified payments log. */
async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const { id, subscriptionId, customerId, details, billedAt, customData } = data;
  const orgId: string | undefined = customData?.orgId;

  // Prefer the subscription row's org, fall back to customData
  let resolvedOrgId = orgId;
  if (!resolvedOrgId && subscriptionId) {
    const { data: sub } = await getSupabase()
      .from("subscriptions")
      .select("org_id")
      .eq("paddle_subscription_id", subscriptionId)
      .eq("environment", env)
      .maybeSingle();
    resolvedOrgId = (sub as any)?.org_id;
  }
  if (!resolvedOrgId) return;

  // Paddle returns totals in the lowest denomination (cents). Convert to major units.
  const totalMinor = Number(details?.totals?.total ?? 0);
  const currency = (details?.totals?.currencyCode ?? "USD").toLowerCase();
  const amount = totalMinor / 100;

  await getSupabase().from("payments").insert({
    org_id: resolvedOrgId,
    provider: "paddle",
    provider_payment_id: id,
    amount_ars: amount, // legacy column reused; UI reads `currency` to format
    currency,
    status: "approved",
    paid_at: billedAt ?? new Date().toISOString(),
    raw: { subscriptionId, customerId, env, totals: details?.totals },
  } as any);

  await getSupabase().from("organizations")
    .update({ last_payment_at: billedAt ?? new Date().toISOString() } as any)
    .eq("id", resolvedOrgId);
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env);
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
