import { createFileRoute, Link } from "@tanstack/react-router";
import { FluxLogo } from "@/components/flux-logo";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/refunds")({
  component: RefundsPage,
  head: () => ({
    meta: [
      { title: "Política de Reembolsos — FLUX Talent" },
      { name: "description", content: "Membresía mensual con garantía de devolución de 14 días corridos desde la fecha del pago." },
      { property: "og:title", content: "Política de Reembolsos — FLUX Talent" },
      { property: "og:description", content: "Membresía mensual con garantía de devolución de 14 días corridos desde la fecha del pago." },
    ],
  }),
});

function RefundsPage() {
  const t = useT();
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
        <h1>{t("Política de Reembolsos")}</h1>
        <p className="text-sm text-muted-foreground">{t("Última actualización: 30 de julio de 2026")}</p>

        <h2>{t("Garantía de 14 días")}</h2>
        <p>
          {t("FLUX Talent se contrata como")} <strong>{t("membresía mensual")}</strong>{t(". Ofrecemos una")}{" "}
          <strong>{t("garantía de devolución de 14 días corridos contados desde la fecha del pago")}</strong>
          {t(": si dentro de ese plazo no está satisfecho, puede solicitar el reembolso íntegro del importe abonado. Pasados los 14 días, el mes en curso no es reembolsable, pero puede cancelar en cualquier momento para evitar cargos futuros (ver \"Cancelación de suscripción\").")}
        </p>


        <h2>{t("Cómo solicitar un reembolso")}</h2>
        <h3>{t("Pagos en USD (procesados por Paddle)")}</h3>
        <p>
          {t("Paddle actúa como Merchant of Record para las transacciones internacionales en USD. Para solicitar un reembolso puede:")}
        </p>
        <ul>
          <li>
            {t("Ingresar a")} <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>{" "}
            {t("con el email utilizado en la compra, o")}
          </li>
          <li>{t("Escribirnos a")} <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a> {t("y tramitamos la solicitud con Paddle.")}</li>
        </ul>
        <p>
          {t("Los términos de reembolso de Paddle están disponibles en")}{" "}
          <a href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noopener noreferrer">
            paddle.com/legal/refund-policy
          </a>.
        </p>

        <h3>{t("Pagos en ARS (procesados por Mercado Pago)")}</h3>
        <p>
          {t("Escríbanos a")} <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a> {t("con el email de la cuenta y el ID de la operación de Mercado Pago. Procesamos el reembolso en un plazo máximo de 10 días hábiles a través del mismo medio de pago utilizado.")}
        </p>

        <h2>{t("Cancelación de suscripción")}</h2>
        <p>
          {t("Puede cancelar su suscripción en cualquier momento desde su panel de suscripción. La cancelación es efectiva al finalizar el período pago vigente: mantendrá el acceso hasta esa fecha y no se generarán cargos posteriores. La cancelación por sí sola no genera reembolso; si adicionalmente desea el reembolso del período en curso, solicítelo dentro del plazo de 14 días corridos desde el pago indicado arriba.")}
        </p>

        <h2>{t("Renovaciones automáticas")}</h2>
        <p>
          {t("Las suscripciones se renuevan automáticamente. Si un cargo de renovación no fue intencional y nos contacta dentro de los 14 días corridos posteriores al mismo, procesaremos el reembolso.")}
        </p>

        <h2>{t("Contacto")}</h2>
        <p>
          {t("Cualquier consulta sobre reembolsos:")} <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a>{" "}
          {t("o WhatsApp")}{" "}
          <a href="https://wa.me/543519090777" target="_blank" rel="noopener noreferrer">+54 351 909-0777</a>.
        </p>

        <p className="text-sm text-muted-foreground">
          {t("Ver también")} <Link to="/terms">{t("Términos y Condiciones")}</Link> {t("y")}{" "}
          <Link to="/privacy">{t("Política de Privacidad")}</Link>.
        </p>
      </main>
    </div>
  );
}
