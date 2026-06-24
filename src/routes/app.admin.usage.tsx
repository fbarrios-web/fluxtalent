import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminUsage } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Sparkles, Mail, HardDrive, DollarSign, Calendar } from "lucide-react";

export const Route = createFileRoute("/app/admin/usage")({
  component: UsagePage,
  head: () => ({ meta: [{ title: "Consumo — Admin · FLUX Talent" }] }),
});

const fmtUsd = (n: number) => `US$ ${n.toFixed(2)}`;
const fmtBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1_073_741_824) return `${(b / 1_048_576).toFixed(1)} MB`;
  return `${(b / 1_073_741_824).toFixed(2)} GB`;
};

function UsagePage() {
  const fn = useServerFn(adminUsage);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-usage"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!data) return null;

  const cards = [
    {
      icon: Sparkles,
      title: "IA · análisis de CV",
      primary: data.ai.calls30.toLocaleString(),
      sub: "llamadas últimos 30 días",
      detail: `${data.ai.calls7.toLocaleString()} en los últimos 7 d · ~${(data.ai.inTok / 1000).toFixed(0)}k tok in / ${(data.ai.outTok / 1000).toFixed(0)}k tok out`,
      cost: data.ai.costUsd,
    },
    {
      icon: Mail,
      title: "Emails enviados",
      primary: data.emails.sent30.toLocaleString(),
      sub: "últimos 30 días",
      detail: data.emails.billable > 0 ? `${data.emails.billable.toLocaleString()} facturables (Resend cobra > 3.000/mes)` : "Dentro del tier gratuito (3.000/mes)",
      cost: data.emails.costUsd,
    },
    {
      icon: HardDrive,
      title: "Almacenamiento",
      primary: fmtBytes(data.storage.totalBytes),
      sub: `${(data.storage.cvs.files + data.storage.orgAssets.files).toLocaleString()} archivos totales`,
      detail: `CVs: ${fmtBytes(data.storage.cvs.bytes)} (${data.storage.cvs.files}) · Assets: ${fmtBytes(data.storage.orgAssets.bytes)} (${data.storage.orgAssets.files})`,
      cost: data.storage.costUsd,
    },
    {
      icon: Calendar,
      title: "Entrevistas agendadas",
      primary: data.interviews30.toLocaleString(),
      sub: "eventos últimos 30 días",
      detail: `Aplicaciones totales: ${data.apps.total.toLocaleString()} · ${data.apps.last30} en 30 d`,
      cost: 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Consumo de plataforma</h2>
          <p className="text-sm text-muted-foreground">Métricas de uso e infraestructura. Costos estimados sobre referencias públicas (Gemini Flash, Resend, S3 std).</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      <Card className="flex items-center justify-between p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Costo total estimado · últimos 30 días</p>
          <p className="mt-1 font-display text-4xl text-primary">{fmtUsd(data.totalCostUsd)}</p>
          <p className="mt-1 text-xs text-muted-foreground">No incluye comisiones de Mercado Pago (~4-6% del ticket) ni instancia base de backend.</p>
        </div>
        <DollarSign className="h-12 w-12 text-primary/30" />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.title} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><c.icon className="h-5 w-5" /></div>
                <h3 className="font-medium">{c.title}</h3>
              </div>
              {c.cost > 0 && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{fmtUsd(c.cost)}</span>
              )}
            </div>
            <p className="mt-4 font-display text-3xl">{c.primary}</p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
            <p className="mt-3 text-xs text-muted-foreground border-t pt-3">{c.detail}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h3 className="font-medium mb-3">Notas de cálculo</h3>
        <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-5">
          <li><strong>IA:</strong> 1 llamada por aplicación + eventos <code>ai.*</code> / <code>report.*</code>. Estimación: 2500 tokens in + 600 out por CV con Gemini 2.5 Flash (US$ 0.075/M in, US$ 0.30/M out).</li>
          <li><strong>Emails:</strong> eventos <code>email.*</code>, <code>interview.invite</code>, <code>interview.booked</code>, <code>rejection.*</code>. Resend: 3.000 gratis/mes, luego US$ 0.40 por cada 1.000.</li>
          <li><strong>Almacenamiento:</strong> tamaño real de los buckets <code>cvs</code> y <code>org-assets</code>. Referencia US$ 0.021/GB-mes.</li>
          <li>El panel se refresca automáticamente cada 60 s.</li>
        </ul>
      </Card>
    </div>
  );
}
