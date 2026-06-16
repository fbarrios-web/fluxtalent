import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListPayments } from "@/lib/admin.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/admin/payments")({
  component: AdminPayments,
});

function AdminPayments() {
  const fn = useServerFn(adminListPayments);
  const { data, isLoading } = useQuery({ queryKey: ["admin-payments"], queryFn: () => fn() });

  if (isLoading) return <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const total = (data ?? []).filter((p: any) => p.status === "approved").reduce((s: number, p: any) => s + Number(p.amount_ars), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-primary p-5 text-primary-foreground">
        <p className="text-xs opacity-80">Total recaudado (aprobados)</p>
        <p className="font-display text-3xl">ARS {total.toLocaleString("es-AR")}</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Organización</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((p: any) => (
              <tr key={p.id}>
                <td className="px-4 py-3">{new Date(p.paid_at ?? p.created_at).toLocaleString("es-AR")}</td>
                <td className="px-4 py-3">{p.organizations?.name ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{p.provider}</td>
                <td className="px-4 py-3 font-medium">ARS {Number(p.amount_ars).toLocaleString("es-AR")}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "approved" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{p.status}</span></td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.provider_payment_id ?? "—"}</td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Sin pagos todavía</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
