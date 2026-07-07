import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, Sparkles, Workflow, Calendar, Mail, BarChart3, ShieldCheck, CheckCircle2,
  Brain, FileText, MessageSquareText, Mic, PenTool, Zap, TrendingUp,
} from "lucide-react";
import { FluxLogo } from "@/components/flux-logo";
import { TRIAL_DAYS, formatArs, mergePlanOverrides } from "@/lib/plans";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlanPricing } from "@/lib/pricing.functions";


export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "FLUX Talent — ATS inteligente para equipos modernos" },
      { name: "description", content: "Publicá vacantes, recibí postulaciones, y dejá que la IA haga el matching, los emails y la coordinación de entrevistas." },
    ],
  }),
});

function Landing() {
  const getPricing = useServerFn(getPlanPricing);
  const { data: overrides } = useQuery({ queryKey: ["plan-pricing"], queryFn: () => getPricing() });
  const plans = mergePlanOverrides(overrides);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <FluxLogo size={32} />
            <span className="text-lg tracking-tight">FLUX <span className="text-muted-foreground font-normal">Talent</span></span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Producto</a>
            <a href="#workflow" className="hover:text-foreground">Workflow</a>
            <a href="#planes" className="hover:text-foreground">Planes</a>
            <a href="#ai" className="hover:text-foreground">IA</a>
          </nav>
          <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Entrar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Matching, parsing y emails con IA
          </div>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight md:text-7xl">
            Reclutá <em className="text-primary">10×</em> más rápido,<br/> sin tareas manuales.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
            FLUX Talent es el ATS donde la IA lee los CVs, calcula el match, redacta los emails y coordina las entrevistas — vos sólo decidís.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Empezar gratis <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#workflow" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent">
              Ver cómo funciona
            </a>
          </div>
        </div>

        <div className="relative mt-16 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">Seguimiento de vacantes</div>
          <div className="grid gap-4 p-6 md:grid-cols-4">
            {[
              { stage: "Recibidos", count: 142, color: "bg-muted", scores: [92, 89, 86] },
              { stage: "Preseleccionados", count: 28, color: "bg-accent", scores: [78, 74, 71] },
              { stage: "Entrevista", count: 12, color: "bg-primary/10", scores: [68, 65, 62] },
              { stage: "Descartado", count: 3, color: "bg-destructive/10", scores: [34, 28, 22] },
            ].map((c) => (
              <div key={c.stage} className={`rounded-xl border border-border p-4 ${c.color}`}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.stage}</div>
                <div className="mt-1 font-display text-3xl">{c.count}</div>
                <div className="mt-3 space-y-2">
                  {[0,1,2].map(i => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-background/80 p-2 text-xs">
                      <span className="truncate">Candidato {i+1}</span>
                      <span className={`rounded-full px-1.5 py-0.5 font-medium ${c.scores[i] < 40 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>{c.scores[i]}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { icon: Sparkles, title: "Matching con IA", desc: "Score por experiencia, formación, skills y competencias. Ranking automático." },
            { icon: Workflow, title: "Pipeline visual", desc: "Kanban, tabla o dashboard. Movés candidatos con un clic." },
            { icon: Mail, title: "Emails automáticos", desc: "Templates con marca y firma. Descartes y avances sin escribir nada." },
            { icon: Calendar, title: "Entrevistas autogestionadas", desc: "El candidato elige horario, se crea la reunión y se invitan a todos." },
            { icon: BarChart3, title: "Dashboard ejecutivo", desc: "Tiempo de cobertura, tasa de descarte, fuente y calidad." },
            { icon: ShieldCheck, title: "Datos seguros", desc: "RLS por organización. CVs cifrados. Cumplimiento GDPR." },
          ].map(f => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="font-display text-4xl">Proceso end-to-end, en una sola pantalla.</h2>
          <ol className="mt-10 space-y-6">
            {[
              ["01", "Creás la vacante", "Definí puesto, seniority, modalidad y % de match mínimo. La IA te ayuda a redactar."],
              ["02", "Recibís postulaciones", "Link público y responsive. Parsing automático de CV."],
              ["03", "La IA hace el ranking", "Score general + por categoría. Detecta fortalezas, gaps y red flags."],
              ["04", "Avanzás o descartás", "Kanban, emails con tu marca, descartes automáticos según umbral."],
              ["05", "Coordinás la entrevista", "El candidato elige horario. Se genera Meet/Zoom automáticamente."],
              
            ].map(([n, t, d]) => (
              <li key={n} className="flex gap-6">
                <div className="font-display text-3xl text-primary">{n}</div>
                <div>
                  <div className="text-lg font-semibold">{t}</div>
                  <div className="text-muted-foreground">{d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="ai" className="border-t border-border bg-gradient-to-b from-background via-primary/5 to-background py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Brain className="h-3.5 w-3.5 text-primary" /> Inteligencia Artificial integrada
            </div>
            <h2 className="font-display text-4xl md:text-5xl">La IA que trabaja por vos,<br/>desde el primer CV hasta la decisión.</h2>
            <p className="mt-4 text-muted-foreground">
              No es un chatbot. Es un motor de decisión que lee, evalúa, pregunta y recomienda — para que vos solo cierres el mejor talento.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Brain,
                title: "Matching inteligente",
                headline: "Score real, no palabras clave.",
                desc: "La IA compara cada candidato contra la vacante en 4 dimensiones: experiencia, formación, skills y competencias. Obtené un score general y un desglose por categoría. El ranking se actualiza solo.",
                highlight: "Auto-rechazo configurable por umbral de match.",
              },
              {
                icon: FileText,
                title: "Parsing automático de CVs",
                headline: "Leé CVs sin abrirlos.",
                desc: "Sube PDF, DOC o DOCX y la IA extrae experiencia, educación y skills en segundos. Construye un perfil estructurado de cada postulante sin intervención manual.",
                highlight: "Soporta español, inglés y portugués.",
              },
              {
                icon: MessageSquareText,
                title: "Preguntas para entrevistas",
                headline: "Entrevistá con inteligencia.",
                desc: "La IA genera 7 preguntas personalizadas por candidato y etapa, basadas en sus gaps detectados y sus fortalezas. Cada pregunta incluye el objetivo detrás.",
                highlight: "Foco en validar riesgos y profundizar aciertos.",
              },
              {
                icon: Mic,
                title: "Análisis de entrevistas",
                headline: "Convertí una conversación en decisión.",
                desc: "Subí la transcripción y la IA evalúa alineación con la vacante, cita evidencia textual, detecta riesgos y recomienda: avanzar, stand by o descartar — con próximos pasos claros.",
                highlight: "Informe ejecutivo exportable en Word.",
              },
              {
                icon: PenTool,
                title: "Redacción con IA",
                headline: "Escribí menos, cerrá más.",
                desc: "La IA redacta descripciones de vacantes profesionales sin sesgos, emails de rechazo cálidos, invitaciones a entrevista y seguimientos — con el tono y la marca de tu empresa.",
                highlight: "Vacantes, emails y follow-ups en segundos.",
              },
              {
                icon: Zap,
                title: "Imágenes para publicaciones",
                headline: "Publicá con diseño propio.",
                desc: "Generá imágenes premium y minimalistas para cada vacante, listas para LinkedIn, Instagram Stories y posts cuadrados. Fondos claros, espacio para texto y sin marca de agua.",
                highlight: "Formatos cuadrado, horizontal y story.",
              },
            ].map((card) => (
              <div key={card.title} className="group relative rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40 hover:shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold">{card.title}</h3>
                </div>
                <p className="mt-3 text-lg font-semibold text-foreground">{card.headline}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  <TrendingUp className="h-3 w-3" /> {card.highlight}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="planes" className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl">Planes y precios</h2>
            <p className="mt-3 text-muted-foreground">
              El plan <strong>Free</strong> incluye <strong>{TRIAL_DAYS} días gratis</strong>, sin tarjeta. Los planes pagos no tienen período de prueba.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map(p => (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 ${p.highlighted ? "border-primary shadow-lg" : "border-border"}`}
              >
                {p.highlighted && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> Recomendado
                  </span>
                )}
                <h3 className="font-display text-2xl">{p.name}</h3>
                <p className="mt-1 min-h-[2.5rem] text-sm text-muted-foreground">{p.tagline}</p>
                <div className="mt-5">
                  {p.originalPriceArs != null && p.originalPriceArs > p.priceArs && (
                    <span className="mr-2 text-lg text-muted-foreground line-through">
                      ARS {p.originalPriceArs.toLocaleString("es-AR")}
                    </span>
                  )}
                  <span className="font-display text-4xl">{formatArs(p.priceArs)}</span>
                  {p.priceArs === 0 ? (
                    <span className="text-sm text-muted-foreground"> / {TRIAL_DAYS} días</span>
                  ) : p.priceArs === -1 ? null : (
                    <span className="text-sm text-muted-foreground"> / mes</span>
                  )}
                  {p.originalPriceArs != null && p.originalPriceArs > p.priceArs && p.priceArs > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      -{Math.round((1 - p.priceArs / p.originalPriceArs) * 100)}%
                    </span>
                  )}
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="flex-1" />
                {p.id === "custom" ? (
                  <a
                    href="mailto:soporte@fluxtalent.com.ar"
                    className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium ${
                      p.highlighted
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border bg-background hover:bg-accent"
                    }`}
                  >
                    Contactar <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <Link
                    to="/auth"
                    className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium ${
                      p.highlighted
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border bg-background hover:bg-accent"
                    }`}
                  >
                    {p.id === "free" ? "Empezar prueba" : "Empezar"} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Precios en pesos argentinos (ARS), facturados mensualmente vía Mercado Pago. IVA incluido.
          </p>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground space-y-2">
        <p>© 2026 FLUX Automatizaciones. Todos los derechos reservados.</p>
        <p>
          Soporte: <a href="mailto:soporte@fluxtalent.com.ar" className="underline">soporte@fluxtalent.com.ar</a> ·{" "}
          <a href="https://wa.me/543519090777?text=Hola%21%20Me%20comunico%20por%20una%20duda%20de%20FLUX%20Talent" target="_blank" rel="noopener noreferrer" className="underline">WhatsApp +54 351 909-0777</a>
        </p>
      </footer>

    </div>
  );
}
