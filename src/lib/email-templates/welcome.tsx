import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX } from './brand'

interface Props {
  fullName?: string
  appUrl?: string
}

const Email = ({ fullName, appUrl = 'https://fluxtalent.com.ar/app/dashboard' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>¡Bienvenid@ a FLUX Talent!</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>¡Bienvenid@{fullName ? `, ${fullName}` : ''}! 👋</Heading>
          <Text style={styles.p}>
            Nos alegra tenerte en <strong>FLUX Talent</strong>. Tu cuenta ya está lista para publicar vacantes,
            recibir postulantes y automatizar tu reclutamiento con IA.
          </Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={appUrl} style={styles.button}>Ir a mi panel</Button>
          </Section>
          <Text style={styles.p}>
            Si necesitás una mano para arrancar, respondé este mail y te ayudamos.
          </Text>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `${SUBJECT_PREFIX}¡Bienvenid@ a tu cuenta!`,
  displayName: 'Bienvenida',
  previewData: { fullName: 'Ana' },
} satisfies TemplateEntry
