import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Footer, Header, styles } from './brand'

interface Props {
  subject?: string
  body?: string
}

const Email = ({ subject = 'Aviso de pagos', body = '' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{subject}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>{subject}</Heading>
          {body.split('\n').map((line, index) => (
            <Text key={`${index}-${line}`} style={styles.p}>{line || ' '}</Text>
          ))}
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => String(data?.subject ?? 'Aviso de pagos'),
  displayName: 'Aviso interno de pagos',
  to: 'soporte@fluxtalent.com.ar',
  previewData: { subject: 'Aviso de pagos', body: 'Organización: Empresa Demo\nEstado: confirmado' },
} satisfies TemplateEntry