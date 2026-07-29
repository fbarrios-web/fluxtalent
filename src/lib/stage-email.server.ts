// Server-only helper to send stage emails (rejection/offer) without a logged-in user,
// e.g. from the public apply endpoint or the background CV analysis worker.
import { sendStageEmail } from "@/lib/scheduling.functions";

/**
 * Pick a user in the org that has Gmail/Outlook connected, preferring the
 * vacancy creator, then any assignee, then any org profile.
 */
async function resolveSenderId(
  supabaseAdmin: any,
  orgId: string,
  preferredUserId?: string | null,
): Promise<string | null> {
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, google_refresh_token, google_email, microsoft_refresh_token, microsoft_email, google_connected_at, microsoft_connected_at")
    .eq("org_id", orgId);
  const usable = (profiles ?? []).filter(
    (p: any) =>
      (p.google_refresh_token && p.google_email) ||
      (p.microsoft_refresh_token && p.microsoft_email),
  );
  if (!usable.length) return null;
  if (preferredUserId) {
    const match = usable.find((p: any) => p.id === preferredUserId);
    if (match) return match.id;
  }
  return usable[0].id;
}

/** Best-effort rejection email for auto-discarded applications. Never throws. */
export async function sendAutoRejectionEmail(
  supabaseAdmin: any,
  applicationId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: app } = await supabaseAdmin
      .from("applications")
      .select("id, org_id, vacancy_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) return { ok: false, error: "application not found" };

    const { data: vac } = await supabaseAdmin
      .from("vacancies")
      .select("created_by")
      .eq("id", app.vacancy_id)
      .maybeSingle();

    const senderId = await resolveSenderId(supabaseAdmin, app.org_id, vac?.created_by);
    if (!senderId) {
      return { ok: false, error: "no connected mailbox" };
    }
    await sendStageEmail(supabaseAdmin, senderId, applicationId, "rejection");
    return { ok: true };
  } catch (e: any) {
    console.error("[sendAutoRejectionEmail]", e?.message ?? e);
    return { ok: false, error: e?.message ?? "unknown" };
  }
}
