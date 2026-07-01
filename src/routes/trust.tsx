import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Lock, Database, Users, Mail, FileText, AlertCircle } from "lucide-react";
import { FluxLogo } from "@/components/flux-logo";

export const Route = createFileRoute("/trust")({
  component: TrustPage,
  head: () => ({
    meta: [
      { title: "Confianza y privacidad — FLUX Talent" },
      { name: "description", content: "Cómo FLUX Talent protege tu información, datos de candidatos y prácticas de privacidad." },
      { property: "og:title", content: "Confianza y privacidad — FLUX Talent" },
      { property: "og:description", content: "Controles de seguridad, privacidad y manejo de datos de FLUX Talent." },
    ],
  }),
});

function Section({ icon: Icon, title, children }: { icon: typeof ShieldCheck; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TrustPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <FluxLogo size={28} />
            <span className="text-base tracking-tight">FLUX <span className="text-muted-foreground font-normal">Talent</span></span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <div className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Confianza y privacidad
          </div>
          <h1 className="font-display text-4xl tracking-tight md:text-5xl">
            Cómo cuidamos tu información
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Esta página la mantiene el equipo de FLUX Talent para responder consultas frecuentes
            sobre seguridad, privacidad y manejo de datos en nuestra plataforma de reclutamiento.
            No constituye una certificación independiente.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Section icon={Lock} title="Acceso y autenticación">
            <p>
              El acceso a la aplicación requiere cuenta verificada por email/contraseña o
              proveedor OAuth de Google. Cada usuario pertenece a una organización y solo
              puede ver datos de su propia organización.
            </p>
            <p>
              Los roles (administrador, reclutador) se administran desde la sección de
              configuración por administradores de la propia organización.
            </p>
          </Section>

          <Section icon={Database} title="Aislamiento de datos por organización">
            <p>
              Cada vacante, postulación, CV y evento de calendario está asociado a una
              organización. La base de datos aplica políticas de fila (RLS) que restringen
              el acceso a usuarios de la misma organización.
            </p>
            <p>
              Los archivos de CV se guardan en almacenamiento privado y se sirven mediante
              enlaces firmados de corta duración.
            </p>
          </Section>

          <Section icon={Users} title="Datos de candidatos">
            <p>
              Procesamos los datos que los candidatos envían a través del formulario público
              de postulación (nombre, contacto, CV, respuestas de screening) y los datos que
              vos cargás manualmente desde la app.
            </p>
            <p>
              La IA analiza el CV para generar resumen, fortalezas y matching contra la
              vacante. No usamos esos datos para entrenar modelos de terceros.
            </p>
          </Section>

          <Section icon={Mail} title="Integraciones y subprocesadores">
            <p>
              Usamos servicios de terceros para funciones específicas: Lovable Cloud
              (hosting y base de datos), Google (OAuth, Gmail y Calendar cuando conectás tu
              cuenta) y Mercado Pago (suscripciones). Cada integración recibe sólo los datos
              que necesita.
            </p>
          </Section>

          <Section icon={FileText} title="Retención y eliminación">
            <p>
              Conservamos los datos de tu organización mientras la cuenta esté activa. Podés
              eliminar vacantes y postulaciones desde la app en cualquier momento. Para una
              eliminación completa de la cuenta, escribinos al contacto de abajo.
            </p>
          </Section>

          <Section icon={AlertCircle} title="Reporte de vulnerabilidades">
            <p>
              Si encontrás un problema de seguridad, te pedimos que nos lo reportes de forma
              responsable al email de contacto antes de divulgarlo públicamente. Vamos a
              responder y trabajar en la mitigación lo antes posible.
            </p>
          </Section>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Responsabilidad compartida</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            FLUX Talent provee la plataforma, los controles técnicos y las integraciones.
            Cada organización cliente es responsable de gestionar sus usuarios, definir
            quién accede a qué información y cumplir con las leyes aplicables (incluida la
            protección de datos personales) en la jurisdicción donde opera.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Contacto</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Para consultas de privacidad, solicitudes de datos o reportes de seguridad,
            escribinos desde la sección de soporte dentro de la app, respondé a cualquiera
            de nuestros emails transaccionales, o contactanos por WhatsApp al{" "}
            <a href="https://wa.me/543519090777?text=Hola%21%20Me%20comunico%20por%20una%20duda%20de%20FLUX%20Talent" target="_blank" rel="noopener noreferrer" className="text-primary underline">+54 351 909-0777</a>.
          </p>
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          Esta página es contenido editable mantenido por FLUX Talent. No representa una
          certificación ni una verificación independiente de Lovable u otro tercero.
        </p>
      </main>
    </div>
  );
}
