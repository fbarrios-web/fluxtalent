import React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Footer, Header, styles, SUBJECT_PREFIX } from "./brand";
import { DEMO_ORGANIZER_EMAIL, DEMO_WHATSAPP } from "@/lib/demo-scheduling.config";

type Props = { firstName?: string; whenLabel?: string; meetLink?: string };

const DemoConfirmationEmail = ({ firstName = "", whenLabel = "", meetLink = "" }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu demo de FLUX Talent quedó confirmada</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>{firstName ? `¡Hola, ${firstName}!` : "¡Hola!"}</Heading>
          <Text style={styles.p}>Tu demo de <strong>FLUX Talent</strong> quedó confirmada para:</Text>
          <Section style={{ background: "#f4f4f5", borderRadius: 8, padding: "14px 18px", margin: "12px 0 20px" }}>
            <Text style={{ ...styles.p, margin: 0 }}><strong>{whenLabel}</strong></Text>
          </Section>
          {meetLink && <Section style={{ textAlign: "center", margin: "24px 0" }}><Button href={meetLink} style={styles.button}>Ingresar al Google Meet</Button></Section>}
          <Text style={styles.p}>Por cualquier duda, podés comunicarte con <strong>{DEMO_ORGANIZER_EMAIL}</strong> o por WhatsApp al <strong>{DEMO_WHATSAPP}</strong>.</Text>
        </Section>
        <Footer locale="es" />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: DemoConfirmationEmail,
  subject: `${SUBJECT_PREFIX}Confirmación de demo`,
  displayName: "Confirmación de demo",
  previewData: { firstName: "María", whenLabel: "martes 13 de octubre de 2026, 10:00", meetLink: "https://meet.google.com/abc-defg-hij" },
} satisfies TemplateEntry;