import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Workflow, Calendar, Mail, BarChart3, ShieldCheck, CheckCircle2 } from "lucide-react";
import { FluxLogo } from "@/components/flux-logo";
import { PLANS, TRIAL_DAYS, formatArs } from "@/lib/plans";


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
            FLUX Talent es el ATS minimalista donde la IA lee los CVs, calcula el match, redacta los emails y coordina las entrevistas — vos sólo decidís.
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
              { stage: "Recibidos", count: 142, color: "bg-muted" },
              { stage: "Preseleccionados", count: 28, color: "bg-accent" },
              { stage: "Entrevista", count: 12, color: "bg-primary/10" },
              { stage: "Oferta", count: 3, color: "bg-primary/20" },
            ].map((c) => (
              <div key={c.stage} className={`rounded-xl border border-border p-4 ${c.color}`}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.stage}</div>
                <div className="mt-1 font-display text-3xl">{c.count}</div>
                <div className="mt-3 space-y-2">
                  {[0,1,2].map(i => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-background/80 p-2 text-xs">
                      <span className="truncate">Candidato {i+1}</span>
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{92-i*3}%</span>
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
              ["06", "Cargás el scorecard", "Feedback estructurado, comparación lado a lado, decisión final."],
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

      <section id="planes" className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl">Planes y precios</h2>
            <p className="mt-3 text-muted-foreground">
              Empezás con <strong>{TRIAL_DAYS} días gratis</strong> en cualquier plan. Sin tarjeta para probar. Cancelás cuando quieras.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANS.map(p => (
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
                  <span className="font-display text-4xl">{formatArs(p.priceArs)}</span>
                  <span className="text-sm text-muted-foreground"> /mes</span>
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="flex-1" />
                <Link
                  to="/auth"
                  className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium ${
                    p.highlighted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border bg-background hover:bg-accent"
                  }`}
                >
                  Empezar prueba <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Precios en pesos argentinos (ARS), facturados mensualmente vía Mercado Pago. IVA incluido.
          </p>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        © 2026 FLUX Automatizaciones. Todos los derechos reservados.
      </footer>

    </div>
  );
}
