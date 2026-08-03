import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX, brand } from './brand'
import { translate, type Lang } from '@/lib/i18n'

interface Props {
  fullName?: string
  appUrl?: string
  locale?: Lang
}

const Email = ({ fullName, appUrl = 'https://fluxtalent.com.ar/app/dashboard', locale = 'es' }: Props) => {
  const t = (s: string, vars?: Record<string, string | number>) => translate(locale, s, vars)
  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Preview>{t('Beneficio exclusivo: 15 días extra de FLUX Talent para vos 🎁')}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.body}>
            <Heading style={styles.h1}>
              {t('{name}te regalamos 15 días más de FLUX Talent 🎁', { name: fullName ? `${fullName}, ` : '' })}
            </Heading>
            <Text style={styles.p}>
              {t('Vimos que creaste tu cuenta en FLUX Talent pero todavía no llegaste a experimentar todo lo que podemos hacer por tu proceso de reclutamiento.')}
            </Text>
            <Text style={styles.p}>
              {t('No queremos que te lo pierdas. Por eso, de manera exclusiva para vos, extendimos tu período de prueba por 15 días más, sin costo.')}
            </Text>

            <Section style={{
              background: brand.bg,
              border: `1px solid ${brand.border}`,
              borderRadius: '10px',
              padding: '18px 20px',
              margin: '20px 0',
            }}>
              <Text style={{ ...styles.p, margin: '0 0 6px', color: brand.text, fontWeight: 700 }}>
                {t('Con tu prueba extendida podés:')}
              </Text>
              <Text style={{ ...styles.p, margin: '4px 0' }}>✅ {t('Publicar 1 vacante')}</Text>
              <Text style={{ ...styles.p, margin: '4px 0' }}>✅ {t('Analizar hasta 20 CVs con IA')}</Text>
              <Text style={{ ...styles.p, margin: '4px 0' }}>✅ {t('Usar match automático, preguntas inteligentes e informes')}</Text>
            </Section>

            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button href={appUrl} style={styles.button}>{t('Volver a FLUX Talent')}</Button>
            </Section>

            <Text style={styles.p}>
              {t('Entrá de nuevo, probá la plataforma y contanos qué te parece. No te vas a arrepentir 💙')}
            </Text>
            <Text style={{ ...styles.p, fontSize: '13px', color: brand.soft }}>
              {t('Si tenés cualquier duda, respondé este mail y te ayudamos.')}
            </Text>
          </Section>
          <Footer locale={locale} />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${SUBJECT_PREFIX}${translate(d?.locale ?? 'es', 'Beneficio exclusivo para vos 🎁 — 15 días más de prueba')}`,
  displayName: 'Trial extendido (+15 días)',
  previewData: { fullName: 'Ana' },
} satisfies TemplateEntry
