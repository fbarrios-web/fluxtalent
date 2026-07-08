import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminListUsers, adminDeleteUser } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/app/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const list = useServerFn(adminListUsers);
  const create = useServerFn(adminCreateUser);
  const del = useServerFn(adminDeleteUser);

  const { data: users, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });

  const [form, setForm] = useState({ email: "", password: "", display_name: "", org_name: "", grant_license: "trial_15" as const });

  const mut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      toast.success("Usuario creado");
      setForm({ email: "", password: "", display_name: "", org_name: "", grant_license: "trial_15" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      qc.invalidateQueries({ queryKey: ["admin-metrics"] });
    },
    onError: (e: any) => toast.error(e.message ?? "No pudimos crear el usuario. Revisá los datos e intentá de nuevo."),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      qc.invalidateQueries({ queryKey: ["admin-metrics"] });
      toast.success(r?.deleted_org ? "Usuario y organización eliminados" : "Usuario eliminado");
    },
    onError: (e: any) => toast.error(e.message ?? "No pudimos eliminar el usuario."),
  });

  return (
    <div className="grid gap-6 md:grid-cols-[400px_1fr]">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4" /> Crear usuario</h3>
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
          <div><Label>Email *</Label><Input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><Label>Contraseña inicial *</Label><Input required type="text" minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          <div><Label>Nombre del usuario *</Label><Input required value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} /></div>
          <div><Label>Nombre de la organización *</Label><Input required value={form.org_name} onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} /></div>
          <div>
            <Label>Licencia inicial</Label>
            <select value={form.grant_license} onChange={e => setForm(f => ({ ...f, grant_license: e.target.value as any }))} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="trial_15">Trial 15 días</option>
              <option value="active_30">Activa · 30 días</option>
              <option value="active_365">Activa · 1 año</option>
              <option value="none">Sin licencia</option>
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear usuario y org
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">Usuarios registrados</h3>
        {isLoading ? <Loader2 className="mt-4 h-5 w-5 animate-spin" /> : (
          <div className="mt-3 max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Nombre</th><th>Organización</th><th>Estado</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(users ?? []).map((u: any) => (
                  <tr key={u.id}>
                    <td className="py-2">{u.display_name}</td>
                    <td>{u.organizations?.name ?? "—"}</td>
                    <td className="capitalize text-xs text-muted-foreground">{u.organizations?.subscription_status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
