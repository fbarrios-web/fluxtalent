import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  fullName?: string
  appUrl?: string
}

const Email = ({ fullName, appUrl = 'https://fluxtalent.com.ar/app/dashboard' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>¡Bienvenid@ a FLUX Talent!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>¡Bienvenid@{fullName ? `, ${fullName}` : ''}! 👋</Heading>
        <Text style={p}>
          Nos alegra tenerte en <strong>FLUX Talent</strong>. Tu cuenta ya está lista para que empieces a
          publicar vacantes, recibir postulantes y automatizar tu proceso de reclutamiento con IA.
        </Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={appUrl} style={button}>Ir a mi panel</Button>
        </Section>
        <Text style={p}>
          Si necesitás una mano para arrancar, respondé este mail y te ayudamos.
        </Text>
        <Hr style={hr} />
        <Text style={small}>El equipo de FLUX Talent · soporte@fluxtalent.com.ar</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '¡Bienvenid@ a FLUX Talent!',
  displayName: 'Bienvenida',
  previewData: { fullName: 'Ana' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { color: '#0F172A', fontSize: '24px', margin: '0 0 16px' }
const p = { color: '#334155', fontSize: '15px', lineHeight: '22px' }
const small = { color: '#94a3b8', fontSize: '12px' }
const button = { backgroundColor: '#0F172A', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
