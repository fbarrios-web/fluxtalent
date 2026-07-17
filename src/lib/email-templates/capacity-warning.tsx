import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  fullName?: string
  planName?: string
  isFree?: boolean
  usagePct?: number
  resourceLabel?: string // e.g. "vacantes" or "CVs"
  appUrl?: string
}

const Email = ({
  fullName,
  planName = 'Free',
  isFree = true,
  usagePct = 80,
  resourceLabel = 'tu plan',
  appUrl = 'https://fluxtalent.com.ar/app/subscription',
}: Props) => {
  const title = isFree ? 'Estás por alcanzar el límite de tu plan Free' : `Estás usando el ${usagePct}% de ${resourceLabel}`
  const cta = isFree ? 'Ver planes y suscribirme' : 'Ampliar mi plan'
  const body = isFree
    ? 'Ya usaste una gran parte de los cupos del plan gratuito. Para seguir publicando vacantes y recibiendo postulaciones sin interrupciones, pasate a un plan pago — desbloqueás más vacantes, más CVs y análisis con IA sin límites.'
    : `Tu plan ${planName} está cerca del tope de ${resourceLabel}. Te recomendamos hacer upgrade para no frenar tus procesos activos.`
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{fullName ? `Hola ${fullName}, ` : ''}{title.toLowerCase()}</Heading>
          <Text style={p}>{body}</Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={appUrl} style={button}>{cta}</Button>
          </Section>
          <Text style={p}>
            Si necesitás asesoramiento para elegir el plan que mejor se adapta a tu equipo, respondé este mail y te ayudamos.
          </Text>
          <Hr style={hr} />
          <Text style={small}>El equipo de FLUX Talent · soporte@fluxtalent.com.ar</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d?.isFree ? 'Tu plan Free está por llegar al límite' : `Estás usando el ${d?.usagePct ?? 80}% de tu plan`,
  displayName: 'Aviso de capacidad',
  previewData: { fullName: 'Ana', isFree: true, usagePct: 85, resourceLabel: 'vacantes' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { color: '#0F172A', fontSize: '22px', margin: '0 0 16px' }
const p = { color: '#334155', fontSize: '15px', lineHeight: '22px' }
const small = { color: '#94a3b8', fontSize: '12px' }
const button = { backgroundColor: '#0F172A', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
