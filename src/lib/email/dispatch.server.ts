/**
 * Server-side email dispatcher for triggers without a user JWT (webhooks, cron, server fns).
 * Renders a registered template and enqueues it via pgmq `enqueue_email` with supabaseAdmin.
 */
import * as React from 'react'
import { render } from '@react-email/render'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SENDER_DOMAIN = 'notify.fluxtalent.com.ar'
const FROM = 'Soporte FLUX Talent <soporte@fluxtalent.com.ar>'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface DispatchParams {
  templateName: string
  recipientEmail: string
  templateData?: Record<string, any>
  idempotencyKey?: string
}

export async function dispatchTransactionalEmail(params: DispatchParams): Promise<{ ok: boolean; error?: string }> {
  const { templateName, recipientEmail, templateData = {}, idempotencyKey } = params
  const entry = TEMPLATES[templateName]
  if (!entry) return { ok: false, error: `Unknown template ${templateName}` }
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Suppression check
    const { data: suppressed } = await supabaseAdmin
      .from('suppressed_emails').select('email').eq('email', recipientEmail.toLowerCase()).maybeSingle()
    if (suppressed) return { ok: false, error: 'suppressed' }

    // Idempotency: skip if already sent
    if (idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from('email_send_log').select('id').eq('idempotency_key', idempotencyKey).limit(1).maybeSingle()
      if (existing) return { ok: true }
    }

    // Unsubscribe token (best effort)
    let unsubscribeToken = ''
    try {
      const { data: tok } = await supabaseAdmin
        .from('email_unsubscribe_tokens').select('token').eq('email', recipientEmail.toLowerCase()).maybeSingle()
      if (tok?.token) unsubscribeToken = tok.token
      else {
        unsubscribeToken = generateToken()
        await supabaseAdmin.from('email_unsubscribe_tokens').insert({ email: recipientEmail.toLowerCase(), token: unsubscribeToken })
      }
    } catch {}

    const Comp = entry.component as any
    const html = await render(React.createElement(Comp, templateData))
    const subject = typeof entry.subject === 'function' ? entry.subject(templateData) : entry.subject
    const messageId = crypto.randomUUID()
    const finalKey = idempotencyKey || messageId

    const payload = {
      from: FROM,
      to: entry.to || recipientEmail,
      subject,
      html,
      sender_domain: SENDER_DOMAIN,
      message_id: messageId,
      template_name: templateName,
      unsubscribe_token: unsubscribeToken,
    }

    const { error } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload,
      idempotency_key: finalKey,
    } as any)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    console.error('[dispatchTransactionalEmail] failed', e)
    return { ok: false, error: e?.message ?? 'unknown' }
  }
}
