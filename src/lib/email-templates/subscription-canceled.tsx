import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX } from './brand'

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
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>Confirmamos la cancelación de tu suscripción 😢</Heading>
          <Text style={styles.p}>
            {fullName ? `${fullName}, ` : ''}¡qué triste verte partir! Damos por cancelada tu suscripción{planName ? ` al plan ${planName}` : ''}.
          </Text>
          {periodEnd && (
            <Text style={styles.p}>
              Vas a poder seguir usando FLUX Talent hasta el <strong>{new Date(periodEnd).toLocaleDateString('es-AR')}</strong>, fecha en la que se cierra el ciclo ya abonado.
            </Text>
          )}
          <Text style={styles.p}>Esperamos volver a verte pronto. Si algo no funcionó como esperabas, contanos respondiendo este mail — nos ayuda muchísimo a mejorar.</Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={appUrl} style={styles.button}>Reactivar mi suscripción</Button>
          </Section>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `${SUBJECT_PREFIX}Confirmamos la cancelación de tu suscripción`,
  displayName: 'Suscripción cancelada',
  previewData: { fullName: 'Ana', planName: 'Starter' },
} satisfies TemplateEntry
