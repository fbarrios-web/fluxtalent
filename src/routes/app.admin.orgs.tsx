import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListOrgs, adminGrantLicense, adminExportClients } from "@/lib/admin.functions";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { PLANS } from "@/lib/plans";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/app/admin/orgs")({
  component: AdminOrgs,
});

const actions = [
  { v: "activate_30", l: "+30 días pago" },
  { v: "activate_90", l: "+90 días pago" },
  { v: "activate_365", l: "1 año pago" },
  { v: "extend_trial_15", l: "+15 días trial" },
  { v: "mark_paid_manual", l: "Marcar pagado" },
  { v: "suspend", l: "Suspender" },
  { v: "cancel", l: "Cancelar" },
] as const;

function AdminOrgs() {
  const qc = useQueryClient();
  const list = useServerFn(adminListOrgs);
  const grant = useServerFn(adminGrantLicense);
  const exportFn = useServerFn(adminExportClients);
  const [filter, setFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["admin-orgs"], queryFn: () => list() });

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await exportFn();
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clientes");
      XLSX.writeFile(wb, `clientes-flux-talent-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${rows.length} clientes exportados`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo exportar");
    } finally {
      setExporting(false);
    }
  };

  const mut = useMutation({
    mutationFn: (vars: { org_id: string; action: any; plan_price_ars?: number; days?: number }) => grant({ data: vars }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-orgs"] }); qc.invalidateQueries({ queryKey: ["admin-metrics"] }); toast.success("Actualizado"); },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const [planDialog, setPlanDialog] = useState<{ orgId: string; orgName: string } | null>(null);

  if (isLoading) return <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const rows = (data ?? []).filter(o => !filter || o.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Buscar organización…"
          className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Exportar clientes (Excel)
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Organización</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Vence</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Último pago</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(o => {
              const expiry = o.subscription_status === "trialing" ? o.trial_ends_at : o.current_period_end;
              const days = expiry ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000) : null;
              return (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs text-muted-foreground">creada {new Date(o.created_at).toLocaleDateString("es-AR")}{(o as any).parent_org_id ? " · sub-org" : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{(o as any).owner_email || <span className="text-muted-foreground">—</span>}</div>
                    {(o as any).owner_name && <div className="text-xs text-muted-foreground">{(o as any).owner_name}</div>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge s={o.subscription_status} /></td>
                  <td className="px-4 py-3">
                    {expiry ? (
                      <div>
                        <div>{new Date(expiry).toLocaleDateString("es-AR")}</div>
                        <div className={`text-xs ${days != null && days < 5 ? "text-destructive" : "text-muted-foreground"}`}>
                          {days != null ? (days >= 0 ? `${days} días` : `vencido hace ${-days}d`) : "—"}
                        </div>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">ARS {Number(o.plan_price_ars).toLocaleString("es-AR")}</td>
                  <td className="px-4 py-3 text-xs">{o.last_payment_at ? new Date(o.last_payment_at).toLocaleDateString("es-AR") : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPlanDialog({ orgId: o.id, orgName: o.name })} disabled={mut.isPending}>
                        Asignar plan
                      </Button>
                      <ActionMenu orgId={o.id} onPick={(action) => mut.mutate({ org_id: o.id, action })} disabled={mut.isPending} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AssignPlanDialog
        open={!!planDialog}
        org={planDialog}
        onClose={() => setPlanDialog(null)}
        onAssign={(plan_price_ars, days) => {
          if (!planDialog) return;
          mut.mutate({ org_id: planDialog.orgId, action: "set_plan", plan_price_ars, days });
          setPlanDialog(null);
        }}
        pending={mut.isPending}
      />
    </div>
  );
}

function AssignPlanDialog({ open, org, onClose, onAssign, pending }: {
  open: boolean;
  org: { orgId: string; orgName: string } | null;
  onClose: () => void;
  onAssign: (plan_price_ars: number, days: number) => void;
  pending: boolean;
}) {
  const assignable = PLANS.filter(p => !p.contactOnly && p.priceArs >= 0);
  const [planId, setPlanId] = useState<string>(assignable[1]?.id ?? assignable[0].id);
  const [days, setDays] = useState<string>("30");
  const plan = assignable.find(p => p.id === planId) ?? assignable[0];
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar plan {org ? `· ${org.orgName}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {assignable.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.priceArs === 0 ? "Gratis" : `ARS ${p.priceArs.toLocaleString("es-AR")} / 15 días.`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Duración</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 días</SelectItem>
                <SelectItem value="30">30 días</SelectItem>
                <SelectItem value="90">90 días</SelectItem>
                <SelectItem value="180">180 días</SelectItem>
                <SelectItem value="365">1 año</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Esta acción marca la suscripción como activa, fija el precio del plan y registra un pago manual.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onAssign(plan.priceArs, Number(days))} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Activar {plan.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = {
    trialing: "bg-accent text-accent-foreground",
    active: "bg-primary/10 text-primary",
    past_due: "bg-destructive/10 text-destructive",
    canceled: "bg-muted text-muted-foreground",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m[s] ?? "bg-muted"}`}>{s}</span>;
}

function ActionMenu({ onPick, disabled }: { orgId: string; onPick: (a: any) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)} disabled={disabled}>Asignar licencia ▾</Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg">
          {actions.map(a => (
            <button key={a.v} onClick={() => { setOpen(false); onPick(a.v); }} className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent">
              {a.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
