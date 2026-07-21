import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX, brand } from './brand'

interface Props {
  fullName?: string
  appUrl?: string
}

const Email = ({ fullName, appUrl = 'https://fluxtalent.com.ar/app/dashboard' }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Beneficio exclusivo: 15 días extra de FLUX Talent para vos 🎁</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>
            {fullName ? `${fullName}, ` : ''}te regalamos 15 días más de FLUX Talent 🎁
          </Heading>
          <Text style={styles.p}>
            Vimos que creaste tu cuenta en FLUX Talent pero todavía no llegaste a experimentar
            todo lo que podemos hacer por tu proceso de reclutamiento.
          </Text>
          <Text style={styles.p}>
            No queremos que te lo pierdas. Por eso, de manera <strong>exclusiva para vos</strong>,
            <strong> extendimos tu período de prueba por 15 días más</strong>, sin costo.
          </Text>

          <Section style={{
            background: brand.bg,
            border: `1px solid ${brand.border}`,
            borderRadius: '10px',
            padding: '18px 20px',
            margin: '20px 0',
          }}>
            <Text style={{ ...styles.p, margin: '0 0 6px', color: brand.text, fontWeight: 700 }}>
              Con tu prueba extendida podés:
            </Text>
            <Text style={{ ...styles.p, margin: '4px 0' }}>✅ Publicar <strong>1 vacante</strong></Text>
            <Text style={{ ...styles.p, margin: '4px 0' }}>✅ Analizar hasta <strong>20 CVs</strong> con IA</Text>
            <Text style={{ ...styles.p, margin: '4px 0' }}>✅ Usar match automático, preguntas inteligentes e informes</Text>
          </Section>

          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={appUrl} style={styles.button}>Volver a FLUX Talent</Button>
          </Section>

          <Text style={styles.p}>
            Entrá de nuevo, probá la plataforma y contanos qué te parece. No te vas a arrepentir 💙
          </Text>
          <Text style={{ ...styles.p, fontSize: '13px', color: brand.soft }}>
            Si tenés cualquier duda, respondé este mail y te ayudamos.
          </Text>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `${SUBJECT_PREFIX}Beneficio exclusivo para vos 🎁 — 15 días más de prueba`,
  displayName: 'Trial extendido (+15 días)',
  previewData: { fullName: 'Ana' },
} satisfies TemplateEntry
