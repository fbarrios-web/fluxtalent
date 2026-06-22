import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlanPricing, adminUpdatePlanPricing } from "@/lib/pricing.functions";
import { PLANS } from "@/lib/plans";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/admin/pricing")({
  component: AdminPricing,
});

function AdminPricing() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPlanPricing);
  const updFn = useServerFn(adminUpdatePlanPricing);
  const { data, isLoading } = useQuery({ queryKey: ["plan-pricing"], queryFn: () => getFn() });

  const [rows, setRows] = useState<Record<string, { base: string; disc: string }>>({});

  useEffect(() => {
    if (!data) return;
    const m: Record<string, { base: string; disc: string }> = {};
    PLANS.forEach(p => {
      const o = data.find(x => x.plan_id === p.id);
      m[p.id] = { base: String(o?.base_price_ars ?? (p.originalPriceArs ?? p.priceArs)), disc: String(o?.discount_pct ?? 0) };
    });
    setRows(m);
  }, [data]);

  const mut = useMutation({
    mutationFn: (v: { plan_id: string; base_price_ars: number; discount_pct: number }) => updFn({ data: v }),
    onSuccess: () => { toast.success("Precio actualizado"); qc.invalidateQueries({ queryKey: ["plan-pricing"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  if (isLoading) return <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl">Precios y descuentos</h2>
        <p className="text-sm text-muted-foreground">Definí el precio base y un porcentaje de descuento por plan. Se aplica en la landing, en suscripción y al asignar planes.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Precio base (ARS)</th>
              <th className="px-4 py-3">Descuento (%)</th>
              <th className="px-4 py-3">Precio final</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PLANS.map(p => {
              const r = rows[p.id] ?? { base: "0", disc: "0" };
              const base = Number(r.base);
              const disc = Math.max(0, Math.min(100, Number(r.disc) || 0));
              const final = base < 0 ? -1 : Math.round(base * (1 - disc / 100));
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      className="max-w-[160px]"
                      value={r.base}
                      onChange={e => setRows(s => ({ ...s, [p.id]: { ...s[p.id], base: e.target.value } }))}
                    />
                    {p.id === "custom" && <p className="mt-1 text-xs text-muted-foreground">Usá -1 para "A medida".</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="max-w-[100px]"
                      value={r.disc}
                      onChange={e => setRows(s => ({ ...s, [p.id]: { ...s[p.id], disc: e.target.value } }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {final === -1 ? <span>A medida</span> : final === 0 ? <span>Gratis</span> : <span>ARS {final.toLocaleString("es-AR")}</span>}
                    {disc > 0 && base > 0 && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        -{disc}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" onClick={() => mut.mutate({ plan_id: p.id, base_price_ars: base, discount_pct: disc })} disabled={mut.isPending}>
                      {mut.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                      Guardar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
