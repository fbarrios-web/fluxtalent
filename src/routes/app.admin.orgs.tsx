import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListOrgs, adminGrantLicense, adminExportClients, adminDeleteOrg, adminSetOrgArchived } from "@/lib/admin.functions";
import { Download, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Columns3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useRef, useState } from "react";
import { PLANS, planByPrice } from "@/lib/plans";
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
  { v: "grant_admin_unlimited", l: "★ Activar admin (ilimitado)" },
  { v: "revoke_admin_unlimited", l: "Quitar admin ilimitado" },
  { v: "suspend", l: "Suspender" },
  { v: "cancel", l: "Cancelar" },
] as const;

type SortKey = "users" | "vac_total" | "vac_active" | "cvs" | "expiry" | null;
type SortDir = "asc" | "desc";

type ColKey = "org" | "email" | "users" | "vacancies" | "cvs" | "status" | "expiry" | "plan" | "last_payment" | "actions";
const COLUMNS: { key: ColKey; label: string; sticky?: boolean }[] = [
  { key: "org", label: "Organización", sticky: true },
  { key: "email", label: "Email", sticky: true },
  { key: "users", label: "Usuarios" },
  { key: "vacancies", label: "Vacantes" },
  { key: "cvs", label: "CVs procesados" },
  { key: "status", label: "Estado" },
  { key: "expiry", label: "Vence" },
  { key: "plan", label: "Plan" },
  { key: "last_payment", label: "Último pago" },
  { key: "actions", label: "Acciones" },
];

function AdminOrgs() {
  const qc = useQueryClient();
  const list = useServerFn(adminListOrgs);
  const grant = useServerFn(adminGrantLicense);
  const exportFn = useServerFn(adminExportClients);
  const delFn = useServerFn(adminDeleteOrg);
  const archiveFn = useServerFn(adminSetOrgArchived);
  const [filter, setFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [hidden, setHidden] = useState<Set<ColKey>>(() => {
    try {
      const raw = localStorage.getItem("admin-orgs-hidden-cols");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  useEffect(() => {
    try { localStorage.setItem("admin-orgs-hidden-cols", JSON.stringify([...hidden])); } catch {}
  }, [hidden]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orgs", view],
    queryFn: () => list({ data: { archived: view === "archived" } }),
  });

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

  const delMut = useMutation({
    mutationFn: (org_id: string) => delFn({ data: { org_id } }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["admin-orgs"] }); qc.invalidateQueries({ queryKey: ["admin-metrics"] }); qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success(`Cuenta eliminada (${r?.deleted_users ?? 0} usuario/s)`); },
    onError: (e: any) => toast.error(e.message ?? "Error al eliminar"),
  });

  const archiveMut = useMutation({
    mutationFn: (vars: { org_id: string; archived: boolean }) => archiveFn({ data: vars }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      qc.invalidateQueries({ queryKey: ["admin-metrics"] });
      toast.success(vars.archived ? "Organización archivada" : "Organización restaurada");
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const [planDialog, setPlanDialog] = useState<{ orgId: string; orgName: string } | null>(null);

  const rows = useMemo(() => {
    let r = (data ?? []).filter(o => {
      if (filter && !o.name.toLowerCase().includes(filter.toLowerCase())) return false;
      if (emailFilter && !((o as any).owner_email ?? "").toLowerCase().includes(emailFilter.toLowerCase())) return false;
      if (statusFilter !== "all" && effectiveStatus(o) !== statusFilter) return false;
      if (planFilter !== "all") {
        const plan = (o as any).is_unlimited ? "unlimited" : planByPrice(o.plan_price_ars).id;
        if (plan !== planFilter) return false;
      }
      return true;
    });
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      r = [...r].sort((a: any, b: any) => {
        const va = valFor(a, sortKey);
        const vb = valFor(b, sortKey);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return va < vb ? -1 * dir : va > vb ? 1 * dir : 0;
      });
    }
    return r;
  }, [data, filter, emailFilter, statusFilter, planFilter, sortKey, sortDir]);

  // Top scrollbar sync
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  useEffect(() => {
    if (!tableRef.current) return;
    const ro = new ResizeObserver(() => setTableWidth(tableRef.current?.scrollWidth ?? 0));
    ro.observe(tableRef.current);
    return () => ro.disconnect();
  }, [rows.length, hidden]);
  const syncingRef = useRef(false);
  const onTopScroll = () => {
    if (syncingRef.current || !bottomScrollRef.current || !topScrollRef.current) return;
    syncingRef.current = true;
    bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    requestAnimationFrame(() => (syncingRef.current = false));
  };
  const onBottomScroll = () => {
    if (syncingRef.current || !bottomScrollRef.current || !topScrollRef.current) return;
    syncingRef.current = true;
    topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    requestAnimationFrame(() => (syncingRef.current = false));
  };

  const toggleSort = (k: Exclude<SortKey, null>) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const toggleCol = (k: ColKey) => {
    setHidden(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };
  const isVisible = (k: ColKey) => !hidden.has(k);

  const stickyLeft: Partial<Record<ColKey, string>> = {
    org: "left-0",
    email: "left-[220px]",
  };

  if (isLoading) return <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button
              onClick={() => setView("active")}
              className={`rounded-md px-3 py-1.5 text-sm ${view === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >Activas</button>
            <button
              onClick={() => setView("archived")}
              className={`rounded-md px-3 py-1.5 text-sm ${view === "archived" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >Archivadas</button>
          </div>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Buscar organización…"
            className="w-56 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={emailFilter}
            onChange={e => setEmailFilter(e.target.value)}
            placeholder="Filtrar por email…"
            className="w-56 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="trialing">Trial</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="past_due">Vencido</SelectItem>
              <SelectItem value="canceled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los planes</SelectItem>
              <SelectItem value="unlimited">★ Admin ilimitado</SelectItem>
              {PLANS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9"><Columns3 className="mr-2 h-4 w-4" />Columnas</Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Mostrar columnas</div>
                {COLUMNS.map(c => (
                  <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={isVisible(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Exportar clientes (Excel)
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {/* Top scrollbar */}
        <div ref={topScrollRef} onScroll={onTopScroll} className="overflow-x-auto overflow-y-hidden">
          <div style={{ width: tableWidth, height: 1 }} />
        </div>
        <div ref={bottomScrollRef} onScroll={onBottomScroll} className="overflow-auto max-h-[70vh]">
          <table ref={tableRef} className="w-full text-sm border-separate border-spacing-0">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                {isVisible("org") && (
                  <th className={`sticky top-0 ${stickyLeft.org} z-30 bg-muted px-4 py-3 min-w-[220px] border-b border-border shadow-[1px_0_0_0_hsl(var(--border))]`}>Organización</th>
                )}
                {isVisible("email") && (
                  <th className={`sticky top-0 ${stickyLeft.email} z-30 bg-muted px-4 py-3 min-w-[220px] border-b border-border shadow-[1px_0_0_0_hsl(var(--border))]`}>Email</th>
                )}
                {isVisible("users") && <SortableTh label="Usuarios" active={sortKey === "users"} dir={sortDir} onClick={() => toggleSort("users")} />}
                {isVisible("vacancies") && (
                  <th className="sticky top-0 z-20 bg-muted px-4 py-3 border-b border-border whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("vac_total")}>
                        Vacantes {sortIcon(sortKey === "vac_total", sortDir)}
                      </button>
                      <span className="text-muted-foreground/50">·</span>
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("vac_active")}>
                        activas {sortIcon(sortKey === "vac_active", sortDir)}
                      </button>
                    </div>
                  </th>
                )}
                {isVisible("cvs") && <SortableTh label="CVs procesados" active={sortKey === "cvs"} dir={sortDir} onClick={() => toggleSort("cvs")} />}
                {isVisible("status") && <PlainTh>Estado</PlainTh>}
                {isVisible("expiry") && <SortableTh label="Vence" active={sortKey === "expiry"} dir={sortDir} onClick={() => toggleSort("expiry")} />}
                {isVisible("plan") && <PlainTh>Plan</PlainTh>}
                {isVisible("last_payment") && <PlainTh>Último pago</PlainTh>}
                {isVisible("actions") && <PlainTh>Acciones</PlainTh>}
              </tr>
            </thead>
            <tbody>
              {rows.map(o => {
                const expiry = o.subscription_status === "trialing" ? o.trial_ends_at : o.current_period_end;
                const days = expiry ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000) : null;
                return (
                  <tr key={o.id} className="group">
                    {isVisible("org") && (
                      <td className={`sticky ${stickyLeft.org} z-10 bg-card group-hover:bg-muted/30 px-4 py-3 border-b border-border shadow-[1px_0_0_0_hsl(var(--border))]`}>
                        <div className="font-medium">{o.name}</div>
                        <div className="text-xs text-muted-foreground">creada {new Date(o.created_at).toLocaleDateString("es-AR")}{(o as any).parent_org_id ? " · sub-org" : ""}</div>
                      </td>
                    )}
                    {isVisible("email") && (
                      <td className={`sticky ${stickyLeft.email} z-10 bg-card group-hover:bg-muted/30 px-4 py-3 border-b border-border shadow-[1px_0_0_0_hsl(var(--border))]`}>
                        <div className="text-sm">{(o as any).owner_email || <span className="text-muted-foreground">—</span>}</div>
                        {(o as any).owner_name && <div className="text-xs text-muted-foreground">{(o as any).owner_name}</div>}
                      </td>
                    )}
                    {isVisible("users") && <td className="px-4 py-3 text-sm border-b border-border">{(o as any).users_count ?? 0}</td>}
                    {isVisible("vacancies") && (
                      <td className="px-4 py-3 text-sm border-b border-border">
                        <div>{(o as any).vacancies_total ?? 0} <span className="text-xs text-muted-foreground">totales</span></div>
                        <div className="text-xs text-muted-foreground">{(o as any).vacancies_active ?? 0} activas</div>
                      </td>
                    )}
                    {isVisible("cvs") && <td className="px-4 py-3 text-sm border-b border-border">{(o as any).cvs_processed ?? 0}</td>}
                    {isVisible("status") && <td className="px-4 py-3 border-b border-border"><StatusBadge s={effectiveStatus(o)} /></td>}
                    {isVisible("expiry") && (
                      <td className="px-4 py-3 border-b border-border">
                        {expiry ? (
                          <div>
                            <div>{new Date(expiry).toLocaleDateString("es-AR")}</div>
                            <div className={`text-xs ${days != null && days < 5 ? "text-destructive" : "text-muted-foreground"}`}>
                              {days != null ? (days >= 0 ? `${days} días` : `vencido hace ${-days}d`) : "—"}
                            </div>
                          </div>
                        ) : "—"}
                      </td>
                    )}
                    {isVisible("plan") && (
                      <td className="px-4 py-3 border-b border-border">
                        <div className="font-medium">
                          {(o as any).is_unlimited
                            ? "★ Admin ilimitado"
                            : (o.subscription_status === "trialing" ? "Free (trial)" : planByPrice(o.plan_price_ars).name)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(o as any).is_unlimited ? "Sin costo · no cuenta en ganancias" : `ARS ${Number(o.plan_price_ars).toLocaleString("es-AR")}/mes`}
                        </div>
                      </td>
                    )}
                    {isVisible("last_payment") && <td className="px-4 py-3 text-xs border-b border-border">{o.last_payment_at ? new Date(o.last_payment_at).toLocaleDateString("es-AR") : "—"}</td>}
                    {isVisible("actions") && (
                      <td className="px-4 py-3 border-b border-border">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setPlanDialog({ orgId: o.id, orgName: o.name })} disabled={mut.isPending}>
                            Asignar plan
                          </Button>
                          <ActionMenu orgId={o.id} onPick={(action) => mut.mutate({ org_id: o.id, action })} disabled={mut.isPending} />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={archiveMut.isPending}
                            onClick={() => archiveMut.mutate({ org_id: o.id, archived: view === "active" })}
                          >
                            {view === "active" ? "Archivar" : "Restaurar"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={delMut.isPending}
                            onClick={() => {
                              if (confirm(`¿Eliminar definitivamente "${o.name}"?\n\nSe borran los usuarios, vacantes, postulaciones y toda la información de esta cuenta. Esta acción no se puede deshacer.`)) {
                                delMut.mutate(o.id);
                              }
                            }}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={COLUMNS.length - hidden.size} className="px-4 py-10 text-center text-sm text-muted-foreground">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
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

function valFor(o: any, key: Exclude<SortKey, null>): number | null {
  switch (key) {
    case "users": return o.users_count ?? 0;
    case "vac_total": return o.vacancies_total ?? 0;
    case "vac_active": return o.vacancies_active ?? 0;
    case "cvs": return o.cvs_processed ?? 0;
    case "expiry": {
      const exp = o.subscription_status === "trialing" ? o.trial_ends_at : o.current_period_end;
      if (!exp) return null;
      return Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000);
    }
  }
}

function sortIcon(active: boolean, dir: SortDir) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function SortableTh({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <th className="sticky top-0 z-20 bg-muted px-4 py-3 border-b border-border whitespace-nowrap">
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={onClick}>
        {label} {sortIcon(active, dir)}
      </button>
    </th>
  );
}

function PlainTh({ children }: { children: React.ReactNode }) {
  return <th className="sticky top-0 z-20 bg-muted px-4 py-3 border-b border-border whitespace-nowrap">{children}</th>;
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

function effectiveStatus(o: any): string {
  const s = o?.subscription_status;
  const now = Date.now();
  if (s === "trialing" && o?.trial_ends_at && new Date(o.trial_ends_at).getTime() < now) return "trial_expired";
  if (s === "active" && o?.current_period_end && new Date(o.current_period_end).getTime() < now) return "subscription_expired";
  return s;
}

function StatusBadge({ s }: { s: string }) {
  const labels: Record<string, string> = {
    trialing: "Trial",
    active: "Activa",
    past_due: "Vencido",
    canceled: "Cancelada",
    trial_expired: "Prueba vencida",
    subscription_expired: "Suscripción vencida",
  };
  const m: Record<string, string> = {
    trialing: "bg-accent text-accent-foreground",
    active: "bg-primary/10 text-primary",
    past_due: "bg-destructive/10 text-destructive",
    canceled: "bg-muted text-muted-foreground",
    trial_expired: "bg-destructive/10 text-destructive",
    subscription_expired: "bg-destructive/10 text-destructive",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m[s] ?? "bg-muted"}`}>{labels[s] ?? s}</span>;
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
