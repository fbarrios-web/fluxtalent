import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX } from './brand'

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
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>¡Listo{fullName ? `, ${fullName}` : ''}! Tu plan {planName} está activo 🎉</Heading>
          <Text style={styles.p}>
            Confirmamos el pago de tu suscripción. Ya tenés habilitado el <strong>plan {planName}</strong> con todos sus beneficios.
          </Text>
          {typeof amountArs === 'number' && amountArs > 0 && (
            <Text style={styles.p}>Monto abonado: <strong>ARS {amountArs.toLocaleString('es-AR')}</strong></Text>
          )}
          {periodEnd && (
            <Text style={styles.p}>Tu próximo ciclo se renueva el <strong>{new Date(periodEnd).toLocaleDateString('es-AR')}</strong>.</Text>
          )}
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={appUrl} style={styles.button}>Ver mi suscripción</Button>
          </Section>
          <Text style={styles.p}>Gracias por confiar en FLUX Talent. Si necesitás una factura o tenés dudas, respondé este mail.</Text>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${SUBJECT_PREFIX}¡Tu plan ${d?.planName ?? ''} está activo!`,
  displayName: 'Suscripción confirmada',
  previewData: { fullName: 'Ana', planName: 'Starter', amountArs: 29900 },
} satisfies TemplateEntry
