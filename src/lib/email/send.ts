import { supabase } from '@/integrations/supabase/client'

export interface SendTransactionalEmailParams {
  templateName: 'welcome' | 'capacity-warning' | 'subscription-confirmed' | 'subscription-canceled'
  recipientEmail: string
  templateData?: Record<string, any>
  idempotencyKey?: string
}

/** Client-side helper: sends an app email via the authenticated Lovable transactional route. */
export async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { ok: false, error: 'No session' }
    const res = await fetch('/lovable/email/transactional/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `${res.status}: ${text}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'unknown' }
  }
}
