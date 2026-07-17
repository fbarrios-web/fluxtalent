import React from 'react'
import { Container, Img, Section, Text, Hr } from '@react-email/components'

// FLUX Talent brand tokens (extracted from logo)
export const brand = {
  navy: '#0B2A5B',
  navyDeep: '#081F44',
  blue: '#1E5FBF',
  cyan: '#22B8D9',
  text: '#0F172A',
  muted: '#475569',
  soft: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F5F8FC',
  white: '#FFFFFF',
  gradient: 'linear-gradient(135deg, #0B2A5B 0%, #1E5FBF 55%, #22B8D9 100%)',
}

export const LOGO_URL = 'https://fluxtalent.com.ar/__l5e/assets-v1/5b5b2bca-044d-49d1-a48f-a2857fec0a6c/flux-talent-logo.png'

export const styles = {
  main: { backgroundColor: brand.bg, fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: '24px 0' },
  container: { maxWidth: '600px', margin: '0 auto', backgroundColor: brand.white, borderRadius: '14px', overflow: 'hidden', border: `1px solid ${brand.border}` } as React.CSSProperties,
  header: { background: brand.gradient, padding: '28px 24px', textAlign: 'center' as const },
  body: { padding: '32px 28px' },
  h1: { color: brand.text, fontSize: '22px', margin: '0 0 16px', fontWeight: 700 as const, lineHeight: '30px' },
  p: { color: brand.muted, fontSize: '15px', lineHeight: '23px', margin: '0 0 14px' },
  button: {
    background: brand.gradient,
    color: brand.white,
    padding: '13px 26px',
    borderRadius: '10px',
    textDecoration: 'none',
    fontWeight: 700 as const,
    fontSize: '15px',
    display: 'inline-block',
  },
  hr: { borderColor: brand.border, margin: '28px 0 18px' },
  footer: { padding: '0 28px 28px', textAlign: 'center' as const },
  small: { color: brand.soft, fontSize: '12px', margin: '4px 0', lineHeight: '18px' },
}

export const Header = () => (
  <Section style={styles.header}>
    <Img src={LOGO_URL} alt="FLUX Talent" width="72" height="72" style={{ display: 'block', margin: '0 auto 8px', borderRadius: '12px', backgroundColor: brand.white, padding: '6px' }} />
    <Text style={{ color: brand.white, fontSize: '13px', letterSpacing: '3px', fontWeight: 700, margin: 0 }}>FLUX TALENT</Text>
  </Section>
)

export const Footer = () => (
  <>
    <Hr style={styles.hr} />
    <Section style={styles.footer}>
      <Text style={styles.small}>El equipo de FLUX Talent</Text>
      <Text style={styles.small}>soporte@fluxtalent.com.ar · fluxtalent.com.ar</Text>
    </Section>
  </>
)

export const SUBJECT_PREFIX = 'FLUX Talent · '
