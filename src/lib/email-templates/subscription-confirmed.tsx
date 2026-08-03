import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX } from './brand'
import { translate, type Lang } from '@/lib/i18n'

interface Props {
  fullName?: string
  planName?: string
  amountArs?: number
  periodEnd?: string
  appUrl?: string
  locale?: Lang
}

const Email = ({ fullName, planName = 'Starter', amountArs, periodEnd, appUrl = 'https://fluxtalent.com.ar/app/subscription', locale = 'es' }: Props) => {
  const t = (s: string, vars?: Record<string, string | number>) => translate(locale, s, vars)
  const dateLocale = locale === 'en' ? 'en-US' : 'es-AR'
  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Preview>{t('¡Tu plan {planName} está activo!', { planName })}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.body}>
            <Heading style={styles.h1}>{t('¡Listo{name}! Tu plan {planName} está activo 🎉', { name: fullName ? `, ${fullName}` : '', planName })}</Heading>
            <Text style={styles.p}>
              {t('Confirmamos el pago de tu suscripción. Ya tenés habilitado el plan {planName} con todos sus beneficios.', { planName })}
            </Text>
            {typeof amountArs === 'number' && amountArs > 0 && (
              <Text style={styles.p}>{t('Monto abonado:')} <strong>ARS {amountArs.toLocaleString(dateLocale)}</strong></Text>
            )}
            {periodEnd && (
              <Text style={styles.p}>{t('Tu próximo ciclo se renueva el {date}.', { date: new Date(periodEnd).toLocaleDateString(dateLocale) })}</Text>
            )}
            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button href={appUrl} style={styles.button}>{t('Ver mi suscripción')}</Button>
            </Section>
            <Text style={styles.p}>{t('Gracias por confiar en FLUX Talent. Si necesitás una factura o tenés dudas, respondé este mail.')}</Text>
          </Section>
          <Footer locale={locale} />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${SUBJECT_PREFIX}${translate(d?.locale ?? 'es', '¡Tu plan {planName} está activo!', { planName: d?.planName ?? '' })}`,
  displayName: 'Suscripción confirmada',
  previewData: { fullName: 'Ana', planName: 'Starter', amountArs: 29900 },
} satisfies TemplateEntry
