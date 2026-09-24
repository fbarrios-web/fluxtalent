/** Server-side dispatcher for app emails triggered by webhooks and server functions. */
import { sendTemplateEmail } from '@/lib/email-templates/send-email'

export interface DispatchParams {
  templateName: string
  recipientEmail: string
  templateData?: Record<string, any>
  idempotencyKey?: string
  locale?: 'es' | 'en'
}

export async function dispatchTransactionalEmail(params: DispatchParams): Promise<{ ok: boolean; error?: string }> {
  const { templateName, recipientEmail, templateData = {}, idempotencyKey, locale } = params
  try {
    const mergedData = locale ? { ...templateData, locale } : templateData
    const result = await sendTemplateEmail(templateName, recipientEmail, {
      templateData: mergedData,
      idempotencyKey,
      replyTo: 'soporte@fluxtalent.com.ar',
    })
    if (!result.sent) return { ok: false, error: result.reason }
    return { ok: true }
  } catch (e: any) {
    console.error('[dispatchTransactionalEmail] failed', e)
    return { ok: false, error: e?.message ?? 'unknown' }
  }
}
