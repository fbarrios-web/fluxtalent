import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX } from './brand'
import { translate, type Lang } from '@/lib/i18n'

interface Props {
  fullName?: string
  planName?: string
  periodEnd?: string
  appUrl?: string
  locale?: Lang
}

const Email = ({ fullName, planName, periodEnd, appUrl = 'https://fluxtalent.com.ar/app/subscription', locale = 'es' }: Props) => {
  const t = (s: string, vars?: Record<string, string | number>) => translate(locale, s, vars)
  const dateLocale = locale === 'en' ? 'en-US' : 'es-AR'
  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Preview>{t('Confirmamos la cancelación de tu suscripción')}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.body}>
            <Heading style={styles.h1}>{t('Confirmamos la cancelación de tu suscripción 😢')}</Heading>
            <Text style={styles.p}>
              {t('{name}¡qué triste verte partir! Damos por cancelada tu suscripción{plan}.', {
                name: fullName ? `${fullName}, ` : '',
                plan: planName ? ` al plan ${planName}` : '',
              })}
            </Text>
            {periodEnd && (
              <Text style={styles.p}>
                {t('Vas a poder seguir usando FLUX Talent hasta el {date}, fecha en la que se cierra el ciclo ya abonado.', { date: new Date(periodEnd).toLocaleDateString(dateLocale) })}
              </Text>
            )}
            <Text style={styles.p}>{t('Esperamos volver a verte pronto. Si algo no funcionó como esperabas, contanos respondiendo este mail — nos ayuda muchísimo a mejorar.')}</Text>
            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button href={appUrl} style={styles.button}>{t('Reactivar mi suscripción')}</Button>
            </Section>
          </Section>
          <Footer locale={locale} />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${SUBJECT_PREFIX}${translate(d?.locale ?? 'es', 'Confirmamos la cancelación de tu suscripción')}`,
  displayName: 'Suscripción cancelada',
  previewData: { fullName: 'Ana', planName: 'Starter' },
} satisfies TemplateEntry
