import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX } from './brand'
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
      <Preview>{t('¡Bienvenid@ a FLUX Talent!')}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.body}>
            <Heading style={styles.h1}>{t('¡Bienvenid@{name}! 👋', { name: fullName ? `, ${fullName}` : '' })}</Heading>
            <Text style={styles.p}>
              {t('Nos alegra tenerte en FLUX Talent. Tu cuenta ya está lista para publicar vacantes, recibir postulantes y automatizar tu reclutamiento con IA.')}
            </Text>
            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button href={appUrl} style={styles.button}>{t('Ir a mi panel')}</Button>
            </Section>
            <Text style={styles.p}>
              {t('Si necesitás una mano para arrancar, respondé este mail y te ayudamos.')}
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
  subject: (d: Record<string, any>) => `${SUBJECT_PREFIX}${translate(d?.locale ?? 'es', '¡Bienvenid@ a tu cuenta!')}`,
  displayName: 'Bienvenida',
  previewData: { fullName: 'Ana' },
} satisfies TemplateEntry
