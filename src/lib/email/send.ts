import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/** Sends the welcome email to the authenticated account only. */
export const sendWelcomeEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = context.claims.email
    if (typeof email !== 'string' || !email) return { ok: false, error: 'No email' }
    const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
    const result = await sendTemplateEmail('welcome', email, {
      templateData: { fullName: email.split('@')[0] },
      idempotencyKey: `welcome-${context.userId}`,
      replyTo: 'soporte@fluxtalent.com.ar',
    })
    return result.sent ? { ok: true } : { ok: false, error: result.reason }
  })
