import { createFileRoute, Link } from "@tanstack/react-router";
import { FluxLogo } from "@/components/flux-logo";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidad — FLUX Talent" },
      { name: "description", content: "Cómo FLUX Talent recolecta, usa y protege sus datos personales." },
      { property: "og:title", content: "Política de Privacidad — FLUX Talent" },
      { property: "og:description", content: "Cómo FLUX Talent recolecta, usa y protege sus datos personales." },
    ],
  }),
});

function PrivacyPage() {
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
        <h1>{t("Política de Privacidad")}</h1>
        <p className="text-sm text-muted-foreground">{t("Última actualización: 21 de julio de 2026")}</p>

        <h2>{t("1. Responsable del tratamiento")}</h2>
        <p>
          {t("El responsable del tratamiento de sus datos personales es")} <strong>FLUX Talent</strong>
          {t('(en adelante, "nosotros"). Actuamos como')} <strong>{t("controlador de datos")}</strong> {t("respecto de los datos de nuestros clientes titulares de cuenta, y como")} <strong>{t("encargado del tratamiento")}</strong>
          {t("respecto de los datos de postulantes que nuestros clientes cargan en la plataforma.")}
        </p>
        <p>{t("Contacto de privacidad:")} <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a>.</p>

        <h2>{t("2. Datos que recolectamos")}</h2>
        <ul>
          <li><strong>{t("Datos de cuenta:")}</strong> {t("nombre, email, DNI, fecha de nacimiento, teléfono, contraseña cifrada.")}</li>
          <li><strong>{t("Datos de organización:")}</strong> {t("razón social, país, provincia, logo, dominio.")}</li>
          <li><strong>{t("Datos de postulantes cargados por clientes:")}</strong> {t("nombre, email, CV, historial laboral, formación, competencias.")}</li>
          <li><strong>{t("Datos de uso:")}</strong> {t("páginas visitadas, acciones realizadas, dirección IP, agente de usuario, timestamps.")}</li>
          <li><strong>{t("Datos de soporte:")}</strong> {t("mensajes y adjuntos enviados a nuestro equipo.")}</li>
          <li><strong>{t("Datos de facturación:")}</strong> {t("los datos de pago (tarjeta) NO son almacenados por nosotros; los procesan directamente Mercado Pago y Paddle.")}</li>
        </ul>

        <h2>{t("3. Finalidades y base legal")}</h2>
        <ul>
          <li><strong>{t("Prestación del Servicio")}</strong> — {t("ejecución del contrato.")}</li>
          <li><strong>{t("Facturación y gestión de suscripciones")}</strong> — {t("ejecución del contrato y obligación legal.")}</li>
          <li><strong>{t("Seguridad, prevención de fraude y abuso")}</strong> — {t("interés legítimo.")}</li>
          <li><strong>{t("Mejora del producto y analítica agregada")}</strong> — {t("interés legítimo.")}</li>
          <li><strong>{t("Soporte al usuario")}</strong> — {t("ejecución del contrato.")}</li>
          <li><strong>{t("Comunicaciones transaccionales")}</strong> — {t("ejecución del contrato.")}</li>
          <li><strong>{t("Comunicaciones comerciales")}</strong> — {t("consentimiento, revocable en cualquier momento.")}</li>
        </ul>

        <h2>{t("4. Compartición de datos (subprocesadores y terceros)")}</h2>
        <p>{t("Compartimos datos únicamente con las siguientes categorías de destinatarios:")}</p>
        <ul>
          <li><strong>{t("Proveedores de infraestructura:")}</strong> {t("hosting, base de datos y almacenamiento (Supabase, Cloudflare).")}</li>
          <li><strong>{t("Proveedores de IA:")}</strong> {t("para funciones de matching, parsing y redacción (Google, OpenAI, Anthropic vía nuestro gateway).")}</li>
          <li><strong>{t("Procesador de pagos ARS:")}</strong> Mercado Pago.</li>
          <li>
            <strong>{t("Merchant of Record para pagos USD:")}</strong> {t("Paddle.com, que actúa como reseller y responsable de facturación, cobro, impuestos y devoluciones para las transacciones internacionales. Ver")}{" "}
            <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">
              {t("política de privacidad de Paddle")}
            </a>.
          </li>
          <li><strong>{t("Email transaccional:")}</strong> {t("Resend, para notificaciones y emails de sistema.")}</li>
          <li><strong>{t("Integraciones opcionales activadas por el usuario:")}</strong> Google Workspace, Microsoft 365.</li>
          <li><strong>{t("Asesores profesionales")}</strong> {t("(legales, contables) bajo obligación de confidencialidad.")}</li>
          <li><strong>{t("Autoridades competentes")}</strong> {t("cuando exista obligación legal.")}</li>
        </ul>

        <h2>{t("5. Transferencias internacionales")}</h2>
        <p>
          {t("Algunos proveedores mencionados están ubicados fuera de Argentina (Estados Unidos, Unión Europea). En esos casos utilizamos salvaguardas contractuales adecuadas (Cláusulas Contractuales Tipo) y seleccionamos proveedores con estándares de protección equivalentes.")}
        </p>

        <h2>{t("6. Retención")}</h2>
        <ul>
          <li>{t("Datos de cuenta: mientras la cuenta esté activa y hasta 24 meses después de la baja.")}</li>
          <li>{t("Datos de postulantes (a cargo del cliente): eliminados cuando el cliente los borra o cierra su cuenta, salvo obligación legal de conservación.")}</li>
          <li>{t("Datos de facturación: 10 años, por obligaciones fiscales.")}</li>
          <li>{t("Registros técnicos y logs: hasta 12 meses.")}</li>
        </ul>
        <p>{t("Al vencer el plazo, los datos se eliminan o anonimizan de forma segura.")}</p>

        <h2>{t("7. Sus derechos")}</h2>
        <p>{t("De acuerdo con la ley aplicable, usted puede ejercer los siguientes derechos:")}</p>
        <ul>
          <li>{t("Acceso a sus datos personales.")}</li>
          <li>{t("Rectificación de datos inexactos.")}</li>
          <li>{t("Supresión (derecho al olvido).")}</li>
          <li>{t("Limitación u oposición al tratamiento.")}</li>
          <li>{t("Portabilidad.")}</li>
          <li>{t("Revocación del consentimiento.")}</li>
          <li>{t("Presentar un reclamo ante la autoridad de control (en Argentina, la Agencia de Acceso a la Información Pública).")}</li>
        </ul>
        <p>
          {t("Para ejercer estos derechos:")} <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a>.
          {t("Responderemos dentro del plazo legal aplicable (normalmente 30 días).")}
        </p>

        <h2>{t("8. Seguridad")}</h2>
        <p>
          {t("Aplicamos medidas técnicas y organizativas razonables: cifrado en tránsito (HTTPS) y en reposo, controles de acceso por rol, aislamiento por organización mediante Row-Level Security, registro de auditoría, monitoreo y respaldo de datos.")}
        </p>

        <h2>{t("9. Cookies")}</h2>
        <p>
          {t("Utilizamos cookies esenciales para autenticación y funcionamiento del Servicio. Podemos usar cookies analíticas para entender el uso agregado del producto. No usamos cookies publicitarias de terceros. Puede gestionar las cookies desde su navegador.")}
        </p>

        <h2>{t("10. Menores")}</h2>
        <p>
          {t("El Servicio no está dirigido a menores de 18 años. No recolectamos deliberadamente datos de menores.")}
        </p>

        <h2>{t("11. Cambios")}</h2>
        <p>
          {t("Podemos actualizar esta política. Notificaremos cambios materiales por email o dentro del Servicio.")}
        </p>

        <p className="text-sm text-muted-foreground">
          {t("Ver también")} <Link to="/terms">{t("Términos y Condiciones")}</Link> {t("y")}{" "}
          <Link to="/refunds">{t("Política de Reembolsos")}</Link>.
        </p>
      </main>
    </div>
  );
}
