import React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { Footer, Header, styles, SUBJECT_PREFIX } from "./brand";
import { DEMO_ORGANIZER_EMAIL, DEMO_WHATSAPP } from "@/lib/demo-scheduling.config";

type Props = { kind?: "canceled" | "rescheduled"; firstName?: string; whenLabel?: string; previousLabel?: string; meetLink?: string };

const DemoUpdateEmail = ({ kind = "rescheduled", firstName = "", whenLabel = "", previousLabel = "", meetLink = "" }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{kind === "canceled" ? "Tu demo de FLUX Talent fue cancelada" : "Tu demo de FLUX Talent fue reprogramada"}</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Header />
        <Section style={styles.body}>
          <Heading style={styles.h1}>{firstName ? `¡Hola, ${firstName}!` : "¡Hola!"}</Heading>
          {kind === "canceled" ? <>
            <Text style={styles.p}>Te avisamos que tu demo de <strong>FLUX Talent</strong> del <strong>{previousLabel}</strong> fue cancelada.</Text>
            <Text style={styles.p}>Si querés, podés reservar un nuevo horario en <a href="https://fluxtalent.com.ar/reservar-demo">fluxtalent.com.ar/reservar-demo</a>.</Text>
          </> : <>
            <Text style={styles.p}>Tu demo de <strong>FLUX Talent</strong> fue reprogramada{previousLabel ? <> (antes: {previousLabel})</> : null}. El nuevo horario es:</Text>
            <Section style={{ background: "#f4f4f5", borderRadius: 8, padding: "14px 18px", margin: "12px 0 20px" }}>
              <Text style={{ ...styles.p, margin: 0 }}><strong>{whenLabel}</strong></Text>
            </Section>
            {meetLink && <Section style={{ textAlign: "center", margin: "24px 0" }}><Button href={meetLink} style={styles.button}>Ingresar al Google Meet</Button></Section>}
          </>}
          <Text style={styles.p}>Por cualquier duda, podés comunicarte con <strong>{DEMO_ORGANIZER_EMAIL}</strong> o por WhatsApp al <strong>{DEMO_WHATSAPP}</strong>.</Text>
        </Section>
        <Footer locale="es" />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: DemoUpdateEmail,
  subject: (d: Record<string, any>) => `${SUBJECT_PREFIX}${d.kind === "canceled" ? "Demo cancelada" : "Demo reprogramada"}`,
  displayName: "Demo cancelada / reprogramada",
  previewData: { kind: "rescheduled", firstName: "María", whenLabel: "jueves 15 de octubre de 2026, 11:00", previousLabel: "martes 13 de octubre de 2026, 10:00", meetLink: "https://meet.google.com/abc-defg-hij" },
} satisfies TemplateEntry;
