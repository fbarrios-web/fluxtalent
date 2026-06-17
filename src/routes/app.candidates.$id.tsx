import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzeApplication, aiInterviewQuestions, aiDraftEmail } from "@/lib/ai.functions";
import { moveApplicationStage, getSignedCvUrl, saveScorecard } from "@/lib/recruiting.functions";
import { ArrowLeft, Sparkles, Loader2, FileText, Mail, MessageSquare, AlertTriangle, CheckCircle2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchPill } from "./app.dashboard";

const STAGES = ["received", "interview_1", "interview_2", "interview_3", "offer", "hired", "rejected"];

export const Route = createFileRoute("/app/candidates/$id")({
  component: CandidateDetail,
});

function CandidateDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeApplication);
  const move = useServerFn(moveApplicationStage);
  const signCv = useServerFn(getSignedCvUrl);
  const draftEmail = useServerFn(aiDraftEmail);
  const interviewQs = useServerFn(aiInterviewQuestions);
  const saveScore = useServerFn(saveScorecard);

  const { data: app, isLoading } = useQuery<any>({
    queryKey: ["candidate", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("*, vacancy:vacancies(id, title, requirements, min_match), scorecards(*), application_events(*)")
        .eq("id", id)
        .single();
      return data;
    },
    refetchInterval: (q: any) => (q.state.data?.ai_status === "running" || q.state.data?.ai_status === "pending" ? 3000 : false),
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [emailKind, setEmailKind] = useState<"rejection" | "interview_invite" | "offer" | "followup">("interview_invite");
  const [emailBody, setEmailBody] = useState("");
  const [genEmail, setGenEmail] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [genQ, setGenQ] = useState(false);

  if (isLoading || !app) return <div className="p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const a = app as any;

  async function runAi() {
    setAnalyzing(true);
    try { await analyze({ data: { applicationId: id } }); toast.success("Análisis completado"); qc.invalidateQueries({ queryKey: ["candidate", id] }); }
    catch (e: any) { toast.error(e.message); } finally { setAnalyzing(false); }
  }
  async function setStage(stage: string) {
    await move({ data: { id, stage: stage as any } });
    qc.invalidateQueries({ queryKey: ["candidate", id] });
    toast.success("Etapa actualizada");
  }
  async function openCv() {
    if (!app.cv_url) return;
    const { url } = await signCv({ data: { path: app.cv_url } });
    window.open(url, "_blank");
  }
  async function genEmailNow() {
    setGenEmail(true);
    try { const r = await draftEmail({ data: { applicationId: id, kind: emailKind } }); setEmailBody(r.body); }
    catch (e: any) { toast.error(e.message); } finally { setGenEmail(false); }
  }
  async function genQuestions() {
    setGenQ(true);
    try { const r = await interviewQs({ data: { applicationId: id, stage: app.stage } }); setQuestions(r.questions); }
    catch (e: any) { toast.error(e.message); } finally { setGenQ(false); }
  }

  return (
    <div className="p-6 md:p-10">
      <Link to="/app/vacancies/$vacancyId" params={{ vacancyId: app.vacancy.id }} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a {app.vacancy.title}
      </Link>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl">{app.first_name} {app.last_name}</h1>
              <p className="text-muted-foreground">{app.email}{app.phone ? ` · ${app.phone}` : ""}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {app.linkedin && <a href={app.linkedin} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">LinkedIn</a>}
                {app.cv_url && <button onClick={openCv} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><FileText className="h-3 w-3" /> Ver CV</button>}
              </div>
            </div>
            <MatchPill score={app.match_score} />
          </header>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Análisis con IA</h3>
              {(app.ai_status === "pending" || app.ai_status === "error" || !app.match_score) && (
                <Button size="sm" onClick={runAi} disabled={analyzing}>
                  {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {app.match_score ? "Re-analizar" : "Analizar ahora"}
                </Button>
              )}
              {app.ai_status === "running" && <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> analizando…</span>}
            </div>

            {app.ai_summary ? (
              <>
                <p className="text-sm">{app.ai_summary}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  {Object.entries(app.match_breakdown ?? {}).map(([k, val]) => (
                    <div key={k} className="rounded-xl bg-muted/40 p-3">
                      <div className="text-xs capitalize text-muted-foreground">{k}</div>
                      <div className="font-display text-2xl">{val as number}%</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Insight icon={CheckCircle2} title="Fortalezas" items={app.strengths} color="text-success" />
                  <Insight icon={AlertTriangle} title="Gaps" items={app.gaps} color="text-warning" />
                  <Insight icon={AlertTriangle} title="Red flags" items={app.red_flags} color="text-destructive" />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía sin análisis. Hacé clic en "Analizar ahora".</p>
            )}
          </div>

          <Tabs defaultValue="screening">
            <TabsList>
              <TabsTrigger value="screening">Filtro</TabsTrigger>
              <TabsTrigger value="profile">Perfil parseado</TabsTrigger>
              <TabsTrigger value="email"><Mail className="mr-1 h-3 w-3" /> Email</TabsTrigger>
              <TabsTrigger value="interview"><MessageSquare className="mr-1 h-3 w-3" /> Entrevista</TabsTrigger>
              <TabsTrigger value="scorecard"><Star className="mr-1 h-3 w-3" /> Scorecard</TabsTrigger>
            </TabsList>

            <TabsContent value="screening" className="mt-4 rounded-xl border border-border bg-card p-5">
              {Object.entries(app.screening_answers ?? {}).length === 0 && <p className="text-sm text-muted-foreground">Sin respuestas.</p>}
              <ul className="space-y-3">
                {Object.entries(app.screening_answers ?? {}).map(([q, a]: any) => (
                  <li key={q}>
                    <div className="text-xs text-muted-foreground">{q}</div>
                    <div className="text-sm">{String(a)}</div>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="profile" className="mt-4 space-y-3 rounded-xl border border-border bg-card p-5">
              {(["experience", "education", "skills"] as const).map(k => (
                <div key={k}>
                  <div className="text-xs uppercase text-muted-foreground">{k}</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {(app.parsed_data?.[k] ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="email" className="mt-4 space-y-3 rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={emailKind} onValueChange={(v: any) => setEmailKind(v)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interview_invite">Invitar a entrevista</SelectItem>
                    <SelectItem value="rejection">Descarte amable</SelectItem>
                    <SelectItem value="offer">Oferta</SelectItem>
                    <SelectItem value="followup">Seguimiento</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={genEmailNow} disabled={genEmail} variant="outline">
                  {genEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Redactar con IA
                </Button>
              </div>
              <Textarea rows={10} value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Tu email aparecerá acá…" />
              <Button asChild disabled={!emailBody}>
                <a href={`mailto:${app.email}?subject=${encodeURIComponent("Sobre tu postulación a " + app.vacancy.title)}&body=${encodeURIComponent(emailBody)}`}>Abrir en email</a>
              </Button>
            </TabsContent>

            <TabsContent value="interview" className="mt-4 space-y-3 rounded-xl border border-border bg-card p-5">
              <Button onClick={genQuestions} disabled={genQ} variant="outline">
                {genQ ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Generar preguntas
              </Button>
              <ol className="mt-2 space-y-3">
                {questions.map((q, i) => (
                  <li key={i} className="rounded-lg border border-border p-3">
                    <div className="text-xs uppercase text-muted-foreground">{q.topic}</div>
                    <div className="mt-1 font-medium">{i + 1}. {q.question}</div>
                    <div className="mt-1 text-xs italic text-muted-foreground">{q.rationale}</div>
                  </li>
                ))}
              </ol>
            </TabsContent>

            <TabsContent value="scorecard" className="mt-4 rounded-xl border border-border bg-card p-5">
              <ScorecardForm appId={id} stage={app.stage} onSaved={() => qc.invalidateQueries({ queryKey: ["candidate", id] })} save={saveScore} />
              {!!app.scorecards?.length && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-sm font-semibold">Scorecards anteriores</h4>
                  {app.scorecards.map((s: any) => (
                    <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex justify-between"><span className="font-medium">{s.stage}</span><span>{s.overall}/5 · {s.recommendation}</span></div>
                      {s.notes && <p className="mt-1 text-muted-foreground">{s.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Etapa</h4>
            <Select value={app.stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Historial</h4>
            <ul className="space-y-2 text-xs">
              {(app.application_events ?? []).slice().reverse().map((e: any) => (
                <li key={e.id} className="flex gap-2 text-muted-foreground">
                  <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div><span className="font-medium text-foreground">{e.type}</span> · {new Date(e.created_at).toLocaleString()}</div>
                </li>
              ))}
              <li className="flex gap-2 text-muted-foreground">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <div><span className="font-medium text-foreground">Postulación recibida</span> · {new Date(app.created_at).toLocaleString()}</div>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Insight({ icon: Icon, title, items, color }: any) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className={`mb-1 flex items-center gap-1.5 text-xs font-semibold ${color}`}><Icon className="h-3.5 w-3.5" /> {title}</div>
      {!items?.length ? <div className="text-xs text-muted-foreground">—</div> :
        <ul className="space-y-1 text-xs">{items.map((s: string, i: number) => <li key={i}>· {s}</li>)}</ul>}
    </div>
  );
}

function ScorecardForm({ appId, stage, save, onSaved }: any) {
  const criteria = ["Experiencia técnica", "Comunicación", "Cultura", "Ownership"];
  const [ratings, setRatings] = useState<Record<string, number>>(Object.fromEntries(criteria.map(c => [c, 3])));
  const [overall, setOverall] = useState(3);
  const [rec, setRec] = useState("avanzar");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await save({ data: { application_id: appId, stage, ratings, overall, recommendation: rec, notes } });
      toast.success("Scorecard guardado");
      setNotes("");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  return (
    <div className="space-y-4">
      {criteria.map(c => (
        <div key={c}>
          <div className="mb-1 flex justify-between text-sm"><span>{c}</span><span className="text-muted-foreground">{ratings[c]}/5</span></div>
          <input type="range" min={1} max={5} value={ratings[c]} onChange={e => setRatings(r => ({ ...r, [c]: Number(e.target.value) }))} className="w-full accent-primary" />
        </div>
      ))}
      <div>
        <div className="mb-1 flex justify-between text-sm font-semibold"><span>Score general</span><span>{overall}/5</span></div>
        <input type="range" min={1} max={5} value={overall} onChange={e => setOverall(Number(e.target.value))} className="w-full accent-primary" />
      </div>
      <Select value={rec} onValueChange={setRec}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="hire_strong">Avanzar fuerte</SelectItem>
          <SelectItem value="avanzar">Avanzar</SelectItem>
          <SelectItem value="dudoso">Dudoso</SelectItem>
          <SelectItem value="descartar">Descartar</SelectItem>
        </SelectContent>
      </Select>
      <Textarea rows={4} placeholder="Notas de la entrevista…" value={notes} onChange={e => setNotes(e.target.value)} />
      <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar scorecard</Button>
    </div>
  );
}
