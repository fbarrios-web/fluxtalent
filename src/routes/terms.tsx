import { createFileRoute, Link } from "@tanstack/react-router";
import { FluxLogo } from "@/components/flux-logo";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Términos y Condiciones — FLUX Talent" },
      { name: "description", content: "Términos y condiciones de uso del servicio FLUX Talent." },
      { property: "og:title", content: "Términos y Condiciones — FLUX Talent" },
      { property: "og:description", content: "Términos y condiciones de uso del servicio FLUX Talent." },
    ],
  }),
});

function TermsPage() {
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
        <h1>Términos y Condiciones</h1>
        <p className="text-sm text-muted-foreground">Última actualización: 21 de julio de 2026</p>

        <h2>1. Identificación del proveedor</h2>
        <p>
          El servicio FLUX Talent (en adelante, "el Servicio") es provisto por <strong>FLUX Talent</strong>
          (en adelante, "nosotros", "nuestro" o "el Proveedor"). Al utilizar el Servicio, usted contrata
          directamente con FLUX Talent.
        </p>

        <h2>2. Aceptación</h2>
        <p>
          Al registrarse o continuar utilizando el Servicio, usted acepta estos Términos y Condiciones. Si
          no está de acuerdo, debe dejar de usar el Servicio.
        </p>

        <h2>3. Descripción del Servicio</h2>
        <p>
          FLUX Talent es un sistema de gestión de candidatos (ATS) con funciones de inteligencia artificial
          para matching, parsing de CVs, generación de preguntas de entrevista, análisis y comunicación
          automatizada con postulantes.
        </p>

        <h2>4. Cuentas y credenciales</h2>
        <p>
          Usted debe brindar información veraz y mantenerla actualizada. Es responsable de la confidencialidad
          de sus credenciales y de toda actividad realizada bajo su cuenta. Si actúa en nombre de una
          organización, declara tener autoridad para obligarla.
        </p>

        <h2>5. Uso aceptable</h2>
        <p>Usted se compromete a no usar el Servicio para:</p>
        <ul>
          <li>Actividades ilegales, fraudulentas o engañosas.</li>
          <li>Enviar spam o comunicaciones no solicitadas.</li>
          <li>Infringir derechos de propiedad intelectual de terceros.</li>
          <li>Introducir malware, realizar escaneos de seguridad, scraping o interferir con la integridad del Servicio.</li>
          <li>Cargar datos personales de terceros sin base legal para hacerlo.</li>
        </ul>

        <h2>6. Propiedad intelectual</h2>
        <p>
          FLUX Talent y todo su software, marca, documentación y contenidos son propiedad exclusiva del
          Proveedor. Se le otorga una licencia limitada, no exclusiva, no transferible y revocable para
          utilizar el Servicio dentro del plan contratado. Queda prohibida la ingeniería inversa, reventa,
          redistribución o elusión de límites técnicos.
        </p>

        <h2>7. Contenido del usuario</h2>
        <p>
          Usted conserva la titularidad de los datos y contenidos que cargue (vacantes, CVs, comunicaciones).
          Nos otorga una licencia limitada para alojarlos y procesarlos únicamente con el fin de proveerle
          el Servicio.
        </p>

        <h2>8. Uso de Inteligencia Artificial</h2>
        <p>
          El Servicio incluye funciones de IA generativa (matching, redacción, resúmenes, análisis de
          entrevistas). Los resultados pueden contener errores o imprecisiones y no deben usarse como única
          base para decisiones legales, laborales o médicas sin supervisión humana. Usted es responsable
          de revisar los resultados antes de comunicarlos o actuar sobre ellos, y de contar con los
          derechos necesarios sobre los datos que ingrese al Servicio.
        </p>

        <h2>9. Pagos, facturación y suscripciones</h2>
        <p>
          El Servicio se ofrece bajo suscripciones mensuales. Los pagos en pesos argentinos (ARS) se
          procesan a través de Mercado Pago. Los pagos internacionales en dólares (USD) se procesan a
          través de nuestro reseller autorizado, Paddle.
        </p>
        <p>
          <strong>Aviso Paddle (Merchant of Record):</strong> Our order process is conducted by our online
          reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides
          all customer service inquiries and handles returns. Los términos de compra de Paddle están
          disponibles en{" "}
          <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
            paddle.com/legal/checkout-buyer-terms
          </a>.
        </p>
        <p>
          Las suscripciones se renuevan automáticamente al finalizar cada ciclo. Puede cancelar en
          cualquier momento desde su panel de suscripción; la cancelación se hace efectiva al finalizar
          el período pago vigente. Los impuestos aplicables se agregan según su jurisdicción.
        </p>

        <h2>10. Servicio y disponibilidad</h2>
        <p>
          Hacemos esfuerzos razonables para mantener el Servicio disponible, pero no garantizamos un
          funcionamiento ininterrumpido, libre de errores o exento de mantenimientos programados. En la
          máxima medida permitida por la ley, se excluyen las garantías implícitas de comerciabilidad e
          idoneidad para un propósito particular.
        </p>

        <h2>11. Suspensión y terminación</h2>
        <p>
          Podemos suspender o dar de baja su acceso al Servicio en caso de: (a) incumplimiento material
          de estos Términos, (b) falta de pago, (c) riesgo de seguridad o fraude, o (d) violaciones
          reiteradas o graves de nuestras políticas. Al finalizar el acceso, usted podrá exportar sus
          datos durante un plazo razonable, tras el cual se eliminarán.
        </p>

        <h2>12. Limitación de responsabilidad</h2>
        <p>
          En la máxima medida permitida por la ley, nuestra responsabilidad total agregada frente a
          usted no excederá el monto pagado por el Servicio en los 12 meses anteriores al hecho que
          origina el reclamo. No seremos responsables por daños indirectos, consecuentes, especiales,
          pérdida de beneficios, datos o goodwill. Nada de lo anterior excluye responsabilidades que
          no puedan limitarse por ley (fraude, dolo, daños personales).
        </p>

        <h2>13. Indemnidad</h2>
        <p>
          Usted nos indemnizará frente a reclamos de terceros derivados del contenido que cargue, del
          uso ilícito del Servicio o del incumplimiento de estos Términos.
        </p>

        <h2>14. Ley aplicable y jurisdicción</h2>
        <p>
          Estos Términos se rigen por las leyes de la República Argentina. Cualquier controversia será
          sometida a los tribunales ordinarios competentes de la Ciudad de Córdoba, Argentina, salvo
          normas imperativas de protección al consumidor que dispongan otra jurisdicción.
        </p>

        <h2>15. Cambios</h2>
        <p>
          Podemos actualizar estos Términos. Le notificaremos los cambios materiales a través del
          Servicio o por email. El uso continuado después de la notificación implica aceptación.
        </p>

        <h2>16. Contacto</h2>
        <p>
          Para consultas sobre estos Términos: <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a>.
        </p>

        <p className="text-sm text-muted-foreground">
          Ver también nuestra <Link to="/privacy">Política de Privacidad</Link> y{" "}
          <Link to="/refunds">Política de Reembolsos</Link>.
        </p>
      </main>
    </div>
  );
}
