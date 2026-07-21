import { createFileRoute, Link } from "@tanstack/react-router";
import { FluxLogo } from "@/components/flux-logo";

export const Route = createFileRoute("/refunds")({
  component: RefundsPage,
  head: () => ({
    meta: [
      { title: "Política de Reembolsos — FLUX Talent" },
      { name: "description", content: "Garantía de devolución de 30 días para suscripciones de FLUX Talent." },
      { property: "og:title", content: "Política de Reembolsos — FLUX Talent" },
      { property: "og:description", content: "Garantía de devolución de 30 días para suscripciones de FLUX Talent." },
    ],
  }),
});

function RefundsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <FluxLogo size={28} />
            <span>FLUX <span className="text-muted-foreground font-normal">Talent</span></span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 prose prose-slate dark:prose-invert">
        <h1>Política de Reembolsos</h1>
        <p className="text-sm text-muted-foreground">Última actualización: 21 de julio de 2026</p>

        <h2>Garantía de 30 días</h2>
        <p>
          Ofrecemos una <strong>garantía de devolución de 30 días</strong> para las suscripciones a
          FLUX Talent. Si dentro de los 30 días posteriores a la compra no está satisfecho, puede
          solicitar el reembolso íntegro del importe abonado.
        </p>

        <h2>Cómo solicitar un reembolso</h2>
        <h3>Pagos en USD (procesados por Paddle)</h3>
        <p>
          Paddle actúa como Merchant of Record para las transacciones internacionales en USD. Para
          solicitar un reembolso puede:
        </p>
        <ul>
          <li>
            Ingresar a <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>{" "}
            con el email utilizado en la compra, o
          </li>
          <li>Escribirnos a <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a> y tramitamos la solicitud con Paddle.</li>
        </ul>
        <p>
          Los términos de reembolso de Paddle están disponibles en{" "}
          <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer">
            paddle.com/legal/refund-policy
          </a>.
        </p>

        <h3>Pagos en ARS (procesados por Mercado Pago)</h3>
        <p>
          Escríbanos a <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a> con el
          email de la cuenta y el ID de la operación de Mercado Pago. Procesamos el reembolso en un
          plazo máximo de 10 días hábiles a través del mismo medio de pago utilizado.
        </p>

        <h2>Cancelación de suscripción</h2>
        <p>
          Puede cancelar su suscripción en cualquier momento desde su panel de suscripción. La
          cancelación es efectiva al finalizar el período pago vigente: mantendrá el acceso hasta esa
          fecha y no se generarán cargos posteriores. La cancelación por sí sola no genera reembolso;
          si adicionalmente desea el reembolso del período en curso, solicítelo dentro del plazo de
          30 días indicado arriba.
        </p>

        <h2>Renovaciones automáticas</h2>
        <p>
          Las suscripciones se renuevan automáticamente. Si un cargo de renovación no fue intencional
          y nos contacta dentro de los 30 días posteriores al mismo, procesaremos el reembolso.
        </p>

        <h2>Contacto</h2>
        <p>
          Cualquier consulta sobre reembolsos: <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a>{" "}
          o WhatsApp{" "}
          <a href="https://wa.me/543519090777" target="_blank" rel="noopener noreferrer">+54 351 909-0777</a>.
        </p>

        <p className="text-sm text-muted-foreground">
          Ver también <Link to="/terms">Términos y Condiciones</Link> y{" "}
          <Link to="/privacy">Política de Privacidad</Link>.
        </p>
      </main>
    </div>
  );
}
