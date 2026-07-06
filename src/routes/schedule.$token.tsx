import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/schedule/$token")({
  component: SchedulePage,
  ssr: false,
  head: () => ({ meta: [{ title: "Agendá tu entrevista" }] }),
});

type Slot = { id: string; start_at: string; end_at: string };
type Booking = {
  id: string;
  status: string;
  stage: string;
  scheduled_at: string | null;
  meet_link: string | null;
  duration_minutes: number;
  vacancy_title: string;
  org_name: string;
  consultancy_name: string | null;
  brand_color: string;
  logo_url: string | null;
  timezone: string;
  first_name: string | null;
  candidate_email: string;
  slots: Slot[];
};

function SchedulePage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ meetLink: string | null; when: string } | null>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: res, error } = await supabase.rpc("get_booking_by_token", { _token: token });
    if (error || !res) {
      setData(null);
    } else {
      setData(res as unknown as Booking);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/schedule/logo?token=${encodeURIComponent(token)}`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setLogoSrc(json?.url ?? null);
      } catch { if (!cancelled) setLogoSrc(null); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function book() {
    if (!selected || !data) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/schedule/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slotId: selected }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      const slot = data.slots.find(s => s.id === selected)!;
      const when = new Intl.DateTimeFormat("es-AR", {
        timeZone: data.timezone, dateStyle: "full", timeStyle: "short",
      }).format(new Date(slot.start_at));
      if (json.emailWarning) toast.warning(json.emailWarning);
      setConfirmed({ meetLink: json.meetLink, when });

    } catch (e: any) {
      toast.error(e.message || "No se pudo reservar");
      await load();
      setSelected(null);
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Link inválido</h1>
        <p className="text-muted-foreground">Este link de agenda no existe o expiró. Contactá al reclutador.</p>
      </div>
    </div>;
  }

  const brand = data.brand_color;
  const company = data.consultancy_name || data.org_name;

  if (confirmed) {
    return <div className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full grid place-items-center mb-4" style={{ background: `${brand}15`, color: brand }}>
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">¡Listo!</h1>
        <p className="text-muted-foreground mb-6">Tu entrevista quedó agendada para <strong className="text-foreground">{confirmed.when}</strong>. Te enviamos la invitación por mail.</p>
        {confirmed.meetLink && (
          <a href={confirmed.meetLink} target="_blank" rel="noreferrer">
            <Button style={{ background: brand }}>Abrir Google Meet</Button>
          </a>
        )}
      </div>
    </div>;
  }

  if (data.status === "scheduled" && data.scheduled_at) {
    const when = new Intl.DateTimeFormat("es-AR", {
      timeZone: data.timezone, dateStyle: "full", timeStyle: "short",
    }).format(new Date(data.scheduled_at));
    return <div className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center">
        <h1 className="text-2xl font-semibold mb-2">Entrevista agendada</h1>
        <p className="text-muted-foreground mb-4">{when}</p>
        {data.meet_link && <a href={data.meet_link} target="_blank" rel="noreferrer"><Button style={{ background: brand }}>Abrir Google Meet</Button></a>}
      </div>
    </div>;
  }

  // Group slots by date
  const byDate: Record<string, Slot[]> = {};
  for (const s of data.slots) {
    const key = new Intl.DateTimeFormat("es-AR", { timeZone: data.timezone, weekday: "long", day: "numeric", month: "long" }).format(new Date(s.start_at));
    (byDate[key] ||= []).push(s);
  }
  const dateKeys = Object.keys(byDate);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-2xl mx-auto p-6 md:p-10">
        <header className="mb-8 text-center">
          {data.logo_url
            ? <img src={data.logo_url} alt={company} className="h-12 mx-auto mb-4" />
            : <div className="text-lg font-bold mb-4" style={{ color: brand }}>{company}</div>}
          <h1 className="text-2xl md:text-3xl font-semibold">Hola {data.first_name || ""} 👋</h1>
          <p className="text-muted-foreground mt-2">
            Elegí el horario para tu entrevista de <strong className="text-foreground">{data.vacancy_title}</strong> ({data.duration_minutes} min).
          </p>
        </header>

        {dateKeys.length === 0 && (
          <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
            No hay horarios disponibles por el momento. El reclutador cargará nuevos pronto.
          </div>
        )}

        <div className="space-y-6">
          {dateKeys.map(date => (
            <section key={date} className="bg-card border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium capitalize">
                <Calendar className="h-4 w-4" style={{ color: brand }} />
                {date}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {byDate[date].map(s => {
                  const time = new Intl.DateTimeFormat("es-AR", { timeZone: data.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(s.start_at));
                  const isSel = selected === s.id;
                  return (
                    <button key={s.id} onClick={() => setSelected(s.id)}
                      className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                      style={isSel ? { background: brand, color: "#fff", borderColor: brand } : {}}>
                      {time}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {selected && (
          <div className="sticky bottom-4 mt-6">
            <div className="bg-card border rounded-xl p-4 flex items-center justify-between shadow-lg">
              <div className="text-sm">
                <div className="font-medium">Confirmar horario</div>
                <div className="text-muted-foreground text-xs">
                  {new Intl.DateTimeFormat("es-AR", { timeZone: data.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date(data.slots.find(s => s.id === selected)!.start_at))}
                </div>
              </div>
              <Button disabled={submitting} onClick={book} style={{ background: brand }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reservar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
