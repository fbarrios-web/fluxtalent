import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { X, ArrowRight, ArrowLeft } from "lucide-react";

type Step = {
  target?: string;
  route?: string;
  title: string;
  body: string;
};

export type TourFlow = "general" | "vacancy" | "scheduling" | "candidate";

const GENERAL_STEPS: Step[] = [
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

const VACANCY_STEPS: Step[] = [
  {
    title: "Recorrido de la vacante",
    body: "Te muestro cómo se gestiona una búsqueda: los botones de arriba, el tablero de etapas, el buscador y la configuración de la agenda.",
  },
  {
    target: '[data-tour="vacancy-status"]',
    title: "Activar / Desactivar la búsqueda",
    body: "Con este botón cerrás o reabrís la vacante. Si está desactivada, el formulario público deja de recibir postulaciones.",
  },
  {
    target: '[data-tour="vacancy-edit"]',
    title: "Editar la vacante",
    body: "Cambiá el título, la descripción, los requisitos o el match mínimo. Ojo: si cambiás la descripción, los CVs nuevos se evalúan con esos criterios.",
  },
  {
    target: '[data-tour="vacancy-image"]',
    title: "Imagen para difundir",
    body: "Genera una placa lista para publicar en redes con los datos de la búsqueda, tu logo y el link de postulación.",
  },
  {
    target: '[data-tour="vacancy-upload"]',
    title: "Cargar CV/s",
    body: "Subí currículums que ya tenías (uno o varios a la vez). Se procesan y se les calcula el match igual que a los que llegan por el formulario.",
  },
  {
    target: '[data-tour="vacancy-link"]',
    title: "Copiar link y ver el formulario",
    body: "“Copiar link” te da la URL del formulario público para difundir. “Ver form” lo abre tal cual lo ve el postulante. “Exportar Excel” baja la lista completa.",
  },
  {
    target: '[data-tour="vacancy-tabs"]',
    title: "Vistas de la búsqueda",
    body: "Etapas es el tablero, Tabla es la lista completa ordenable, Detalle de vacante muestra la descripción y Agenda configura las entrevistas.",
  },
  {
    target: '[data-tour="vacancy-search"]',
    title: "Buscador de postulantes",
    body: "Escribí nombre o email para filtrar el tablero y la tabla al instante.",
  },
  {
    target: '[data-tour="kanban-collapse"]',
    title: "Minimizar y expandir columnas",
    body: "Con esta flecha achicás una etapa para ganar espacio; tocando la columna minimizada vuelve a expandirse. Igual podés soltar tarjetas sobre una columna minimizada.",
  },
  {
    title: "Mover postulantes",
    body: "Arrastrá cada tarjeta entre etapas. Al moverla se dispara el email correspondiente (invitación a entrevista o “No avanza”) si tenés la integración conectada.",
  },
  {
    target: '[data-tour="vacancy-scheduling"]',
    title: "Agenda de entrevistas",
    body: "Acá configurás los horarios de entrevista. Cuando entres a la pestaña “Agenda” te muestro un recorrido dedicado, paso a paso.",
  },
  {
    target: '[data-tour="help-button"]',
    title: "Volvé cuando quieras",
    body: "Desde “Ayuda” arriba a la derecha podés reactivar este recorrido en cualquier momento.",
  },
];

const SCHEDULING_STEPS: Step[] = [
  {
    title: "Recorrido de la Agenda",
    body: "Te muestro cómo dejar lista la agenda de entrevistas: duración de los turnos, disponibilidad, horarios puntuales y cómo reserva el postulante.",
  },
  {
    target: '[data-tour="sched-stages"]',
    title: "La agenda se configura por etapa",
    body: "Arriba elegís la etapa (Entrevista 1, 2 o 3): la duración, la disponibilidad y los turnos que cargues aplican sólo a esa etapa. Si usás más de una instancia de entrevista, configurá cada una.",
  },
  {
    target: '[data-tour="sched-general"]',
    title: "Agenda · Configuración general",
    body: "Definís la duración de cada turno en minutos (30, 45, 60…), el email del entrevistador —se suma como invitado al evento del calendario— y podés agregar invitados extra. También hay un campo de instrucciones para el postulante que viaja en la invitación.",
  },
  {
    target: '[data-tour="sched-weekly"]',
    title: "Agenda · Disponibilidad semanal recurrente",
    body: "Es la forma más rápida: elegís uno o varios días de la semana (ej. lunes/miércoles), la hora de inicio y de fin, y opcionalmente desde/hasta cuándo se aplica esa franja. El sistema parte ese rango en turnos según la duración configurada.",
  },
  {
    target: '[data-tour="sched-save"]',
    title: "Agenda · Guardar y regenerar",
    body: "Después de cargar las franjas tocá “Guardar”. Con “Regenerar 30 días” se recrean los turnos del próximo mes a partir de tus reglas. Si borrás una franja, se eliminan sus turnos futuros que nadie haya reservado.",
  },
  {
    target: '[data-tour="sched-manual"]',
    title: "Agenda · Horarios puntuales",
    body: "Si necesitás un turno suelto fuera de la rutina, usá “Agregar horario puntual”: cargás fecha y hora y queda disponible sólo esa vez.",
  },
  {
    target: '[data-tour="sched-calendar"]',
    title: "Agenda · Calendario y bloqueos",
    body: "Abajo ves todos los turnos generados. Podés bloquear o liberar cada uno con un clic (bloqueado = el postulante no lo ve). Los turnos ya reservados quedan marcados con el candidato.",
  },
  {
    title: "Agenda · Cómo reserva el postulante",
    body: "Al mover a alguien a la etapa con agenda, recibe un mail con tu logo y un link para elegir el horario que le sirva. Cuando reserva, se crea el evento en tu calendario, se genera el link de videollamada y se le envía la invitación automáticamente.",
  },
  {
    title: "Agenda · Avisos importantes",
    body: "Sin Google o Microsoft conectado vas a ver una alerta amarilla: no se envían invitaciones ni se crean eventos. Y si un horario se superpone con otra búsqueda tuya, te avisamos antes de guardar para que elijas continuar o cambiarlo.",
  },

  {
    target: '[data-tour="help-button"]',
    title: "Volvé cuando quieras",
    body: "Desde “Ayuda” arriba a la derecha podés reactivar el recorrido de la agenda en cualquier momento.",
  },
];

const CANDIDATE_STEPS: Step[] = [
  {
    title: "Recorrido de la postulación",
    body: "Acá tenés todo sobre un postulante: sus datos, el análisis de IA, el historial y las herramientas para avanzarlo.",
  },
  {
    target: '[data-tour="cand-header"]',
    title: "Datos del postulante",
    body: "Nombre, email y teléfono, más los accesos directos a su LinkedIn y a su CV en PDF. A la derecha ves el puntaje de match con la vacante.",
  },
  {
    target: '[data-tour="cand-ai"]',
    title: "Análisis con IA",
    body: "Resumen automático del perfil frente a la búsqueda, desglose del match por criterio y fortalezas, gaps y red flags. Podés volver a analizarlo si cambiaste la descripción del puesto.",
  },
  {
    target: '[data-tour="cand-stage"]',
    title: "Etapa",
    body: "Cambiá la etapa del postulante desde acá. Es lo mismo que arrastrar la tarjeta en el tablero y también dispara el email correspondiente.",
  },
  {
    target: '[data-tour="cand-history"]',
    title: "Historial",
    body: "Cada movimiento queda registrado: cambios de etapa, emails enviados, entrevistas agendadas y análisis de IA, con fecha y hora.",
  },
  {
    target: '[data-tour="cand-tab-screening"]',
    title: "Filtro",
    body: "Las respuestas a las preguntas de filtro que completó en el formulario de postulación.",
  },
  {
    target: '[data-tour="cand-tab-profile"]',
    title: "Resumen del perfil",
    body: "Lo que la IA extrajo del CV: experiencia, formación y habilidades, ordenado para leerlo de un vistazo.",
  },
  {
    target: '[data-tour="cand-tab-email"]',
    title: "Email",
    body: "Elegí el tipo de mensaje (invitación, no avanza, seguimiento) y la IA lo redacta con el contexto del postulante. Lo podés editar antes de enviarlo.",
  },
  {
    target: '[data-tour="cand-tab-interview"]',
    title: "Entrevista",
    body: "Generá preguntas a medida según el perfil y la etapa, con el porqué de cada una para guiar la entrevista.",
  },
  {
    target: '[data-tour="cand-tab-report"]',
    title: "Informe",
    body: "Pegá la transcripción o el resumen de la entrevista: la IA la cruza con el perfil y la vacante y descargás un informe en Word con tu logo. No incluye la transcripción cruda.",
  },
  {
    target: '[data-tour="help-button"]',
    title: "Listo",
    body: "Desde “Ayuda” arriba a la derecha volvés a ver este recorrido cuando quieras.",
  },
];

export const TOUR_STEPS: Record<TourFlow, Step[]> = {
  general: GENERAL_STEPS,
  vacancy: VACANCY_STEPS,
  scheduling: SCHEDULING_STEPS,
  candidate: CANDIDATE_STEPS,
};

export const TOUR_LABEL: Record<TourFlow, string> = {
  general: "Recorrido general",
  vacancy: "Recorrido de la vacante",
  scheduling: "Recorrido de la agenda",
  candidate: "Recorrido de la postulación",
};

const seenKey = (flow: TourFlow) => `flux-tour-seen-${flow}-v1`;

export function useProductTour(flow: TourFlow) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    // small delay so the page content is mounted before measuring targets
    const t = setTimeout(() => {
      if (cancelled) return;
      let seen = true;
      try { seen = !!localStorage.getItem(seenKey(flow)); } catch { /* ignore */ }
      if (!seen) {
        // mark as seen as soon as it auto-opens, so it never shows twice
        try { localStorage.setItem(seenKey(flow), "1"); } catch { /* ignore */ }
        setOpen(true);
      } else {
        setOpen(false);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [flow]);


  const start = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(seenKey(flow), "1"); } catch { /* ignore */ }
  }, [flow]);

  return { open, start, close, flow };
}

export function ProductTour({ open, onClose, flow = "general" }: { open: boolean; onClose: () => void; flow?: TourFlow }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nav = useNavigate();
  const steps = TOUR_STEPS[flow] ?? TOUR_STEPS.general;
  const step = steps[index];

  useEffect(() => { if (open) setIndex(0); }, [open, flow]);

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

  const last = index === steps.length - 1;
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
        <button onClick={onClose} aria-label={t("Cerrar recorrido")} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="text-xs font-medium text-primary">{t(TOUR_LABEL[flow])} · {t("Paso {n} de {total}", { n: index + 1, total: steps.length })}</div>
        <h3 className="mt-1 text-base font-semibold">{t(step.title)}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t(step.body)}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">{t("Saltar")}</button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={() => setIndex(i => i - 1)}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {t("Atrás")}
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? onClose() : setIndex(i => i + 1))}>
              {last ? t("Entendido") : <>{t("Siguiente")} <ArrowRight className="ml-1 h-3.5 w-3.5" /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mounts the Agenda tour: auto-opens the first time the user opens the Agenda tab. */
export function SchedulingTour() {
  const tour = useProductTour("scheduling");
  return <ProductTour open={tour.open} onClose={tour.close} flow="scheduling" />;
}
