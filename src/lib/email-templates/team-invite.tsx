import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX } from './brand'

interface Props {
  name?: string
  orgName?: string
  inviterName?: string
  email?: string
  password?: string
  loginUrl?: string
}

const Email = ({ name, orgName = 'tu equipo', inviterName, email, password, loginUrl = 'https://fluxtalent.com.ar/auth' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{`Te invitaron a sumarte a ${orgName} en FLUX Talent`}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>{name ? `¡Hola, ${name}!` : '¡Hola!'}</Heading>
          <Text style={styles.p}>
            {inviterName ? `${inviterName} te invitó` : 'Te invitaron'} a sumarte al equipo de <strong>{orgName}</strong> en FLUX Talent.
          </Text>
          <Text style={styles.p}>Estos son tus datos de acceso:</Text>
          <Section style={{ background: '#f4f4f5', borderRadius: 8, padding: '14px 18px', margin: '8px 0 20px' }}>
            <Text style={{ ...styles.p, margin: '0 0 6px' }}><strong>Página:</strong> {loginUrl.replace(/^https?:\/\//, '').replace(/\/auth$/, '')}</Text>
            <Text style={{ ...styles.p, margin: '0 0 6px' }}><strong>Email:</strong> {email}</Text>
            <Text style={{ ...styles.p, margin: 0 }}><strong>Clave:</strong> {password}</Text>
          </Section>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={loginUrl} style={styles.button}>Aceptar invitación e ingresar</Button>
          </Section>
          <Text style={styles.p}>
            Te recomendamos cambiar la clave desde Configuración → Acceso y seguridad después de ingresar.
          </Text>
        </Section>
        <Footer locale="es" />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${SUBJECT_PREFIX}Te invitaron a ${d?.orgName ?? 'FLUX Talent'}`,
  displayName: 'Invitación a equipo',
  previewData: { name: 'Ana', orgName: 'Freddo', email: 'ana@freddo.com.ar', password: 'Clave1234', loginUrl: 'https://freddo.fluxtalent.com.ar/auth' },
} satisfies TemplateEntry
