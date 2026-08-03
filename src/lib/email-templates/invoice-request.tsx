import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX, brand } from './brand'
import { translate, type Lang } from '@/lib/i18n'

interface Props {
  orgName?: string
  requestId?: string
  amountArs?: number | string
  // Datos del usuario
  fullName?: string
  userEmail?: string
  userDni?: string
  country?: string
  province?: string
  // Datos del formulario
  businessName?: string
  cuitOrDni?: string
  billingEmail?: string
  phone?: string
  address?: string
  notes?: string
  locale?: Lang
}

const row = (label: string, value?: string | number | null) => (
  <Text style={{ ...styles.p, margin: '2px 0' }}>
    <strong style={{ color: brand.text }}>{label}:</strong>{' '}
    {value === null || value === undefined || value === '' ? '—' : String(value)}
  </Text>
)

const Email = (p: Props) => {
  const locale: Lang = p.locale ?? 'es'
  const t = (s: string, vars?: Record<string, string | number>) => translate(locale, s, vars)
  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Preview>{t('Nueva solicitud de Factura C — {orgName}', { orgName: p.orgName ?? t('Cliente') })}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.body}>
            <Heading style={styles.h1}>{t('Nueva solicitud de Factura C')}</Heading>
            <Text style={styles.p}>
              <strong>{p.orgName ?? t('Cliente')}</strong> {t('solicitó una Factura C desde el panel de suscripción.')}
            </Text>

            <Text style={{ ...styles.h1, fontSize: '15px', margin: '20px 0 6px' }}>{t('Datos del usuario')}</Text>
            {row(t('Organización'), p.orgName)}
            {row(t('Nombre'), p.fullName)}
            {row(t('Email de la cuenta'), p.userEmail)}
            {row(t('DNI'), p.userDni)}
            {row(t('País / Provincia'), `${p.country ?? '—'} / ${p.province ?? '—'}`)}

            <Text style={{ ...styles.h1, fontSize: '15px', margin: '20px 0 6px' }}>{t('Datos de facturación')}</Text>
            {row(t('Razón social / Nombre'), p.businessName)}
            {row(t('CUIT / DNI'), p.cuitOrDni)}
            {row(t('Email de facturación'), p.billingEmail)}
            {row(t('Teléfono de contacto'), p.phone)}
            {row(t('Domicilio'), p.address)}
            {row(t('Monto'), p.amountArs != null ? `ARS ${p.amountArs}` : '—')}
            {row(t('Notas'), p.notes)}

            <Hr style={styles.hr} />
            <Text style={styles.small}>{t('ID solicitud:')} {p.requestId ?? '—'}</Text>
          </Section>
          <Footer locale={locale} />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${SUBJECT_PREFIX}${translate(d?.locale ?? 'es', 'Solicitud de Factura C — {orgName}', { orgName: d?.orgName ?? translate(d?.locale ?? 'es', 'Cliente') })}`,
  displayName: 'Solicitud de Factura C',
  to: 'soporte@fluxtalent.com.ar',
  previewData: {
    orgName: 'Empresa Demo', fullName: 'Ana Pérez', userEmail: 'ana@demo.com',
    businessName: 'Empresa Demo SRL', cuitOrDni: '20-12345678-9', billingEmail: 'facturacion@demo.com',
    phone: '+54 11 5555 5555', amountArs: 29900, requestId: 'abc-123',
  },
} satisfies TemplateEntry
