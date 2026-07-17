import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Section, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX, brand } from './brand'

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
}

const row = (label: string, value?: string | number | null) => (
  <Text style={{ ...styles.p, margin: '2px 0' }}>
    <strong style={{ color: brand.text }}>{label}:</strong>{' '}
    {value === null || value === undefined || value === '' ? '—' : String(value)}
  </Text>
)

const Email = (p: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Nueva solicitud de Factura C — {p.orgName ?? 'Cliente'}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>Nueva solicitud de Factura C</Heading>
          <Text style={styles.p}>
            <strong>{p.orgName ?? 'Cliente'}</strong> solicitó una Factura C desde el panel de suscripción.
          </Text>

          <Text style={{ ...styles.h1, fontSize: '15px', margin: '20px 0 6px' }}>Datos del usuario</Text>
          {row('Organización', p.orgName)}
          {row('Nombre', p.fullName)}
          {row('Email de la cuenta', p.userEmail)}
          {row('DNI', p.userDni)}
          {row('País / Provincia', `${p.country ?? '—'} / ${p.province ?? '—'}`)}

          <Text style={{ ...styles.h1, fontSize: '15px', margin: '20px 0 6px' }}>Datos de facturación</Text>
          {row('Razón social / Nombre', p.businessName)}
          {row('CUIT / DNI', p.cuitOrDni)}
          {row('Email de facturación', p.billingEmail)}
          {row('Teléfono de contacto', p.phone)}
          {row('Domicilio', p.address)}
          {row('Monto', p.amountArs != null ? `ARS ${p.amountArs}` : '—')}
          {row('Notas', p.notes)}

          <Hr style={styles.hr} />
          <Text style={styles.small}>ID solicitud: {p.requestId ?? '—'}</Text>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${SUBJECT_PREFIX}Solicitud de Factura C — ${d?.orgName ?? 'Cliente'}`,
  displayName: 'Solicitud de Factura C',
  to: 'soporte@fluxtalent.com.ar',
  previewData: {
    orgName: 'Empresa Demo', fullName: 'Ana Pérez', userEmail: 'ana@demo.com',
    businessName: 'Empresa Demo SRL', cuitOrDni: '20-12345678-9', billingEmail: 'facturacion@demo.com',
    phone: '+54 11 5555 5555', amountArs: 29900, requestId: 'abc-123',
  },
} satisfies TemplateEntry
