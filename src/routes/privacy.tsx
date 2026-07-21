import { createFileRoute, Link } from "@tanstack/react-router";
import { FluxLogo } from "@/components/flux-logo";

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
        <h1>Política de Privacidad</h1>
        <p className="text-sm text-muted-foreground">Última actualización: 21 de julio de 2026</p>

        <h2>1. Responsable del tratamiento</h2>
        <p>
          El responsable del tratamiento de sus datos personales es <strong>FLUX Talent</strong>
          (en adelante, "nosotros"). Actuamos como <strong>controlador de datos</strong> respecto de
          los datos de nuestros clientes titulares de cuenta, y como <strong>encargado del tratamiento</strong>
          respecto de los datos de postulantes que nuestros clientes cargan en la plataforma.
        </p>
        <p>Contacto de privacidad: <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a>.</p>

        <h2>2. Datos que recolectamos</h2>
        <ul>
          <li><strong>Datos de cuenta:</strong> nombre, email, DNI, fecha de nacimiento, teléfono, contraseña cifrada.</li>
          <li><strong>Datos de organización:</strong> razón social, país, provincia, logo, dominio.</li>
          <li><strong>Datos de postulantes cargados por clientes:</strong> nombre, email, CV, historial laboral, formación, competencias.</li>
          <li><strong>Datos de uso:</strong> páginas visitadas, acciones realizadas, dirección IP, agente de usuario, timestamps.</li>
          <li><strong>Datos de soporte:</strong> mensajes y adjuntos enviados a nuestro equipo.</li>
          <li><strong>Datos de facturación:</strong> los datos de pago (tarjeta) NO son almacenados por nosotros; los procesan directamente Mercado Pago y Paddle.</li>
        </ul>

        <h2>3. Finalidades y base legal</h2>
        <ul>
          <li><strong>Prestación del Servicio</strong> — ejecución del contrato.</li>
          <li><strong>Facturación y gestión de suscripciones</strong> — ejecución del contrato y obligación legal.</li>
          <li><strong>Seguridad, prevención de fraude y abuso</strong> — interés legítimo.</li>
          <li><strong>Mejora del producto y analítica agregada</strong> — interés legítimo.</li>
          <li><strong>Soporte al usuario</strong> — ejecución del contrato.</li>
          <li><strong>Comunicaciones transaccionales</strong> — ejecución del contrato.</li>
          <li><strong>Comunicaciones comerciales</strong> — consentimiento, revocable en cualquier momento.</li>
        </ul>

        <h2>4. Compartición de datos (subprocesadores y terceros)</h2>
        <p>Compartimos datos únicamente con las siguientes categorías de destinatarios:</p>
        <ul>
          <li><strong>Proveedores de infraestructura:</strong> hosting, base de datos y almacenamiento (Supabase, Cloudflare).</li>
          <li><strong>Proveedores de IA:</strong> para funciones de matching, parsing y redacción (Google, OpenAI, Anthropic vía nuestro gateway).</li>
          <li><strong>Procesador de pagos ARS:</strong> Mercado Pago.</li>
          <li>
            <strong>Merchant of Record para pagos USD:</strong> Paddle.com, que actúa como reseller y
            responsable de facturación, cobro, impuestos y devoluciones para las transacciones
            internacionales. Ver{" "}
            <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">
              política de privacidad de Paddle
            </a>.
          </li>
          <li><strong>Email transaccional:</strong> Resend, para notificaciones y emails de sistema.</li>
          <li><strong>Integraciones opcionales activadas por el usuario:</strong> Google Workspace, Microsoft 365.</li>
          <li><strong>Asesores profesionales</strong> (legales, contables) bajo obligación de confidencialidad.</li>
          <li><strong>Autoridades competentes</strong> cuando exista obligación legal.</li>
        </ul>

        <h2>5. Transferencias internacionales</h2>
        <p>
          Algunos proveedores mencionados están ubicados fuera de Argentina (Estados Unidos, Unión Europea).
          En esos casos utilizamos salvaguardas contractuales adecuadas (Cláusulas Contractuales Tipo) y
          seleccionamos proveedores con estándares de protección equivalentes.
        </p>

        <h2>6. Retención</h2>
        <ul>
          <li>Datos de cuenta: mientras la cuenta esté activa y hasta 24 meses después de la baja.</li>
          <li>Datos de postulantes (a cargo del cliente): eliminados cuando el cliente los borra o cierra su cuenta, salvo obligación legal de conservación.</li>
          <li>Datos de facturación: 10 años, por obligaciones fiscales.</li>
          <li>Registros técnicos y logs: hasta 12 meses.</li>
        </ul>
        <p>Al vencer el plazo, los datos se eliminan o anonimizan de forma segura.</p>

        <h2>7. Sus derechos</h2>
        <p>De acuerdo con la ley aplicable, usted puede ejercer los siguientes derechos:</p>
        <ul>
          <li>Acceso a sus datos personales.</li>
          <li>Rectificación de datos inexactos.</li>
          <li>Supresión (derecho al olvido).</li>
          <li>Limitación u oposición al tratamiento.</li>
          <li>Portabilidad.</li>
          <li>Revocación del consentimiento.</li>
          <li>Presentar un reclamo ante la autoridad de control (en Argentina, la Agencia de Acceso a la Información Pública).</li>
        </ul>
        <p>
          Para ejercer estos derechos: <a href="mailto:soporte@fluxtalent.com.ar">soporte@fluxtalent.com.ar</a>.
          Responderemos dentro del plazo legal aplicable (normalmente 30 días).
        </p>

        <h2>8. Seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas razonables: cifrado en tránsito (HTTPS) y en reposo,
          controles de acceso por rol, aislamiento por organización mediante Row-Level Security,
          registro de auditoría, monitoreo y respaldo de datos.
        </p>

        <h2>9. Cookies</h2>
        <p>
          Utilizamos cookies esenciales para autenticación y funcionamiento del Servicio. Podemos usar
          cookies analíticas para entender el uso agregado del producto. No usamos cookies publicitarias
          de terceros. Puede gestionar las cookies desde su navegador.
        </p>

        <h2>10. Menores</h2>
        <p>
          El Servicio no está dirigido a menores de 18 años. No recolectamos deliberadamente datos de
          menores.
        </p>

        <h2>11. Cambios</h2>
        <p>
          Podemos actualizar esta política. Notificaremos cambios materiales por email o dentro del
          Servicio.
        </p>

        <p className="text-sm text-muted-foreground">
          Ver también <Link to="/terms">Términos y Condiciones</Link> y{" "}
          <Link to="/refunds">Política de Reembolsos</Link>.
        </p>
      </main>
    </div>
  );
}
