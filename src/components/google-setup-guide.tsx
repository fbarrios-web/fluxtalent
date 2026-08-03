import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import img1 from "@/assets/google-guide-10.png.asset.json";
import img2 from "@/assets/google-guide-11.png.asset.json";
import img3 from "@/assets/google-guide-12.png.asset.json";
import img4 from "@/assets/google-guide-13.png.asset.json";
import img5 from "@/assets/google-guide-14.png.asset.json";
import img6 from "@/assets/google-guide-15.png.asset.json";
import { useT } from "@/lib/i18n";

export function GoogleSetupGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);

  const STEPS = [
    {
      title: t("1. Elegí tu cuenta de Google"),
      text: t("Al tocar “Conectar Google” se abre esta pantalla. Elegí la cuenta de mail desde la que querés enviar las invitaciones a los postulantes."),
      img: img1.url,
      alt: t("Pantalla de Google para elegir la cuenta con la que acceder"),
    },
    {
      title: t("2. Tocá “Configuración avanzada”"),
      text: t("Google puede mostrar el aviso “Google no verificó esta app”. Es normal mientras la verificación está en trámite: hacé clic en “Configuración avanzada”."),
      img: img2.url,
      alt: t("Aviso de Google no verificó esta app con el enlace Configuración avanzada resaltado"),
    },
    {
      title: t("3. Entrá al enlace “Ir a fluxtalent…”"),
      text: t("Se despliega un texto abajo. Hacé clic en “Ir a fluxtalent.lovable.app (no seguro)” para continuar."),
      img: img3.url,
      alt: t("Enlace Ir a fluxtalent resaltado dentro de la configuración avanzada"),
    },
    {
      title: t("4. Confirmá el acceso"),
      text: t("Google te pide confirmar la cuenta. Tocá “Continuar”."),
      img: img4.url,
      alt: t("Pantalla de confirmación de acceso con el botón Continuar resaltado"),
    },
    {
      title: t("5. Aceptá todos los permisos"),
      text: t("Importante: dejá tildados todos los permisos (Calendar y envío de mails) y tocá “Continuar”. Si desmarcás alguno, no vamos a poder agendar entrevistas ni enviar las comunicaciones."),
      img: img5.url,
      alt: t("Pantalla de permisos de Google con el botón Continuar resaltado"),
    },
    {
      title: t("6. Listo: integración conectada"),
      text: t("Volvés a FLUX Talent y la tarjeta muestra “Conectado” con tu mail. Desde ese momento cada entrevista genera el evento en Calendar, el link de Meet y el mail al postulante."),
      img: img6.url,
      alt: t("Tarjeta de integraciones de FLUX Talent mostrando el estado Conectado"),
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="h-4 w-4 text-primary" />
          {t("Paso a paso: cómo conectar Google (con imágenes)")}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-6 border-t border-border px-5 py-5">
          {STEPS.map(s => (
            <div key={s.title} className="space-y-2">
              <h4 className="text-sm font-semibold">{s.title}</h4>
              <p className="text-sm text-muted-foreground">{s.text}</p>
              <img
                src={s.img}
                alt={s.alt}
                loading="lazy"
                className="w-full rounded-lg border border-border bg-background"
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            {t("¿Se te complica? Escribinos a")}{" "}
            <a href="mailto:soporte@fluxtalent.com.ar" className="text-primary underline">soporte@fluxtalent.com.ar</a> {t("y lo configuramos con vos.")}
          </p>
        </div>
      )}
    </div>
  );
}
