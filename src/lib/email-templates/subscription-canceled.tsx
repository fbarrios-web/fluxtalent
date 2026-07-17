import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  fullName?: string
  planName?: string
  periodEnd?: string
  appUrl?: string
}

const Email = ({ fullName, planName, periodEnd, appUrl = 'https://fluxtalent.com.ar/app/subscription' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirmamos la cancelación de tu suscripción</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirmamos la cancelación de tu suscripción 😢</Heading>
        <Text style={p}>
          {fullName ? `${fullName}, ` : ''}¡qué triste verte partir! Damos por cancelada tu suscripción{planName ? ` al plan ${planName}` : ''}.
        </Text>
        {periodEnd && (
          <Text style={p}>
            Vas a poder seguir usando FLUX Talent hasta el <strong>{new Date(periodEnd).toLocaleDateString('es-AR')}</strong>, fecha en la que se cierra el ciclo ya abonado.
          </Text>
        )}
        <Text style={p}>Esperamos volver a verte pronto. Si algo no funcionó como esperabas, contanos respondiendo este mail — nos ayuda muchísimo a mejorar.</Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={appUrl} style={button}>Reactivar mi suscripción</Button>
        </Section>
        <Hr style={hr} />
        <Text style={small}>El equipo de FLUX Talent · soporte@fluxtalent.com.ar</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Confirmamos la cancelación de tu suscripción',
  displayName: 'Suscripción cancelada',
  previewData: { fullName: 'Ana', planName: 'Starter' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { color: '#0F172A', fontSize: '22px', margin: '0 0 16px' }
const p = { color: '#334155', fontSize: '15px', lineHeight: '22px' }
const small = { color: '#94a3b8', fontSize: '12px' }
const button = { backgroundColor: '#0F172A', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
