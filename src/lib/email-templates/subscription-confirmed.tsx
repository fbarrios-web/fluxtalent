import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  fullName?: string
  planName?: string
  amountArs?: number
  periodEnd?: string
  appUrl?: string
}

const Email = ({ fullName, planName = 'Starter', amountArs, periodEnd, appUrl = 'https://fluxtalent.com.ar/app/subscription' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>¡Tu plan {planName} está activo!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>¡Listo{fullName ? `, ${fullName}` : ''}! Tu plan {planName} está activo 🎉</Heading>
        <Text style={p}>
          Confirmamos el pago de tu suscripción. Ya tenés habilitado el <strong>plan {planName}</strong> con todos sus beneficios.
        </Text>
        {typeof amountArs === 'number' && amountArs > 0 && (
          <Text style={p}>Monto abonado: <strong>ARS {amountArs.toLocaleString('es-AR')}</strong></Text>
        )}
        {periodEnd && (
          <Text style={p}>Tu próximo ciclo se renueva el <strong>{new Date(periodEnd).toLocaleDateString('es-AR')}</strong>.</Text>
        )}
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={appUrl} style={button}>Ver mi suscripción</Button>
        </Section>
        <Text style={p}>Gracias por confiar en FLUX Talent. Si necesitás una factura o tenés dudas, respondé este mail.</Text>
        <Hr style={hr} />
        <Text style={small}>El equipo de FLUX Talent · soporte@fluxtalent.com.ar</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `¡Tu plan ${d?.planName ?? ''} está activo!`,
  displayName: 'Suscripción confirmada',
  previewData: { fullName: 'Ana', planName: 'Starter', amountArs: 29900 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { color: '#0F172A', fontSize: '22px', margin: '0 0 16px' }
const p = { color: '#334155', fontSize: '15px', lineHeight: '22px' }
const small = { color: '#94a3b8', fontSize: '12px' }
const button = { backgroundColor: '#0F172A', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
