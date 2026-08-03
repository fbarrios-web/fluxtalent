import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

type Step = {
  target?: string;
  route?: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "¡Bienvenid@ a FLUX Talent!",
    body: "Te muestro en 1 minuto cómo publicar tu primera búsqueda, recibir CVs con match automático y activar las comunicaciones. Podés salir cuando quieras.",
  },
  {
    target: '[data-tour="nav-dashboard"]',
    route: "/app/dashboard",
    title: "Dashboard",
    body: "Acá ves el resumen: vacantes activas, CVs recibidos y el consumo de tu plan.",
  },
  {
    target: '[data-tour="nav-vacancies"]',
    route: "/app/vacancies",
    title: "Vacantes",
    body: "Todas tus búsquedas viven acá. Cada vacante tiene su link de postulación, su tablero de etapas y su agenda.",
  },
  {
    target: '[data-tour="new-vacancy"]',
    route: "/app/vacancies",
    title: "Paso 1: creá tu vacante",
    body: "Tocá “Nueva vacante”, cargá título y descripción del puesto. Con eso la IA arma el match de cada CV que entre.",
  },
  {
    target: '[data-tour="new-vacancy"]',
    route: "/app/vacancies",
    title: "Paso 2: compartí el link o cargá CVs",
    body: "Dentro de la vacante tenés el link del formulario para difundir, y el botón “Cargar CV/s” para subir currículums que ya tenés.",
  },
  {
    target: '[data-tour="new-vacancy"]',
    route: "/app/vacancies",
    title: "Paso 3: gestioná en el tablero",
    body: "Los postulantes caen en el tablero de etapas con su puntaje de match. Arrastrá las tarjetas para avanzarlos o marcarlos como “No avanza”.",
  },
  {
    target: '[data-tour="nav-settings"]',
    route: "/app/settings",
    title: "Paso 4: conectá tu mail y calendario",
    body: "En Configuración → Integraciones conectás Google (o Microsoft). Esto es lo que habilita los mails automáticos, los eventos en el calendario y el link de videollamada. Tenés el paso a paso con imágenes.",
  },
  {
    title: "¿Preferís no integrar?",
    body: "Podés usar el sistema igual: vas a poder recibir CVs, ver el match y gestionar el tablero. Lo único que no se activa son las comunicaciones automáticas y la agenda con invitaciones: esos mails los tendrías que enviar por tu cuenta.",
  },
  {
    target: '[data-tour="help-button"]',
    title: "El recorrido queda siempre a mano",
    body: "Cuando tengas dudas, tocá “Ayuda” acá arriba a la derecha y volvés a ver esta guía.",
  },
];

const SEEN_KEY = "flux-tour-seen-v1";

export function useProductTour() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);
  const start = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  }, []);
  return { open, start, close };
}

export function ProductTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nav = useNavigate();
  const step = STEPS[index];

  useEffect(() => { if (open) setIndex(0); }, [open]);

  useEffect(() => {
    if (!open || !step?.route) return;
    nav({ to: step.route }).catch(() => {});
  }, [open, index, step?.route, nav]);

  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    const measure = () => {
      const el = step?.target ? document.querySelector(step.target) : null;
      setRect(el ? el.getBoundingClientRect() : null);
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [open, index, step?.target]);

  if (!open || !step) return null;

  const last = index === STEPS.length - 1;
  const pad = 6;
  const cardTop = rect
    ? Math.min(rect.bottom + 12, (typeof window !== "undefined" ? window.innerHeight : 800) - 240)
    : undefined;
  const cardLeft = rect
    ? Math.min(Math.max(rect.left, 12), (typeof window !== "undefined" ? window.innerWidth : 1200) - 372)
    : undefined;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-foreground/60" onClick={onClose} />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-4 ring-primary"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      )}
      <div
        className="absolute w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-border bg-card p-5 shadow-xl"
        style={
          rect
            ? { top: cardTop, left: cardLeft }
            : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
        }
      >
        <button onClick={onClose} aria-label="Cerrar recorrido" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="text-xs font-medium text-primary">Paso {index + 1} de {STEPS.length}</div>
        <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">Saltar</button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={() => setIndex(i => i - 1)}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Atrás
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? onClose() : setIndex(i => i + 1))}>
              {last ? "Entendido" : <>Siguiente <ArrowRight className="ml-1 h-3.5 w-3.5" /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
