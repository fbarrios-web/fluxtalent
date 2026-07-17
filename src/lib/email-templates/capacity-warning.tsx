import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX } from './brand'

interface Props {
  fullName?: string
  planName?: string
  isFree?: boolean
  usagePct?: number
  resourceLabel?: string
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
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.body}>
            <Heading style={styles.h1}>{fullName ? `Hola ${fullName}, ` : ''}{title.toLowerCase()}</Heading>
            <Text style={styles.p}>{body}</Text>
            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button href={appUrl} style={styles.button}>{cta}</Button>
            </Section>
            <Text style={styles.p}>
              Si necesitás asesoramiento para elegir el plan que mejor se adapta a tu equipo, respondé este mail y te ayudamos.
            </Text>
          </Section>
          <Footer />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d?.isFree
      ? `${SUBJECT_PREFIX}Tu plan Free está por llegar al límite`
      : `${SUBJECT_PREFIX}Estás usando el ${d?.usagePct ?? 80}% de tu plan`,
  displayName: 'Aviso de capacidad',
  previewData: { fullName: 'Ana', isFree: true, usagePct: 85, resourceLabel: 'vacantes' },
} satisfies TemplateEntry
