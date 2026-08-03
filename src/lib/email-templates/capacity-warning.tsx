import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { Header, Footer, styles, SUBJECT_PREFIX } from './brand'
import { translate, type Lang } from '@/lib/i18n'

interface Props {
  fullName?: string
  planName?: string
  isFree?: boolean
  usagePct?: number
  resourceLabel?: string
  appUrl?: string
  locale?: Lang
}

const Email = ({
  fullName,
  planName = 'Free',
  isFree = true,
  usagePct = 80,
  resourceLabel = 'tu plan',
  appUrl = 'https://fluxtalent.com.ar/app/subscription',
  locale = 'es',
}: Props) => {
  const t = (s: string, vars?: Record<string, string | number>) => translate(locale, s, vars)
  const title = isFree
    ? t('Estás por alcanzar el límite de tu plan Free')
    : t('Estás usando el {usagePct}% de {resourceLabel}', { usagePct, resourceLabel })
  const cta = isFree ? t('Ver planes y suscribirme') : t('Ampliar mi plan')
  const body = isFree
    ? t('Ya usaste una gran parte de los cupos del plan gratuito. Para seguir publicando vacantes y recibiendo postulaciones sin interrupciones, pasate a un plan pago — desbloqueás más vacantes, más CVs y análisis con IA sin límites.')
    : t('Tu plan {planName} está cerca del tope de {resourceLabel}. Te recomendamos hacer upgrade para no frenar tus procesos activos.', { planName, resourceLabel })
  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Preview>{title}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Header />
          <Section style={styles.body}>
            <Heading style={styles.h1}>{fullName ? t('Hola {name}, ', { name: fullName }) : ''}{title.toLowerCase()}</Heading>
            <Text style={styles.p}>{body}</Text>
            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button href={appUrl} style={styles.button}>{cta}</Button>
            </Section>
            <Text style={styles.p}>
              {t('Si necesitás asesoramiento para elegir el plan que mejor se adapta a tu equipo, respondé este mail y te ayudamos.')}
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
  subject: (d: Record<string, any>) => {
    const locale: Lang = d?.locale ?? 'es'
    return d?.isFree
      ? `${SUBJECT_PREFIX}${translate(locale, 'Tu plan Free está por llegar al límite')}`
      : `${SUBJECT_PREFIX}${translate(locale, 'Estás usando el {usagePct}% de tu plan', { usagePct: d?.usagePct ?? 80 })}`
  },
  displayName: 'Aviso de capacidad',
  previewData: { fullName: 'Ana', isFree: true, usagePct: 85, resourceLabel: 'vacantes' },
} satisfies TemplateEntry
