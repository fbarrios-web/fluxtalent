import type { ComponentType } from 'react'
import { template as welcomeTemplate } from './welcome'
import { template as capacityWarningTemplate } from './capacity-warning'
import { template as subscriptionConfirmedTemplate } from './subscription-confirmed'
import { template as subscriptionCanceledTemplate } from './subscription-canceled'
import { template as invoiceRequestTemplate } from './invoice-request'
import { template as trialExtendedTemplate } from './trial-extended'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcomeTemplate,
  'capacity-warning': capacityWarningTemplate,
  'subscription-confirmed': subscriptionConfirmedTemplate,
  'subscription-canceled': subscriptionCanceledTemplate,
  'invoice-request': invoiceRequestTemplate,
  'trial-extended': trialExtendedTemplate,
}
