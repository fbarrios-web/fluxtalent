import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myEnterprise, createSubOrg, createSubOrgUser, listEnterpriseUsers } from "@/lib/enterprise.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2, Plus, ShieldAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/app/enterprise")({
  component: EnterprisePage,
  head: () => ({ meta: [{ title: "Multi-organización — FLUX Talent" }] }),
});

function EnterprisePage() {
  const qc = useQueryClient();
  const getEnt = useServerFn(myEnterprise);
  const getUsers = useServerFn(listEnterpriseUsers);
  const createSub = useServerFn(createSubOrg);

  const { data, isLoading } = useQuery({ queryKey: ["my-enterprise"], queryFn: () => getEnt() });
  const { data: users } = useQuery({
    queryKey: ["enterprise-users"], queryFn: () => getUsers(),
    enabled: !!data?.isRoot && !!data?.isEnterprise,
  });

  const [newOrgName, setNewOrgName] = useState("");
  const createMut = useMutation({
    mutationFn: () => createSub({ data: { name: newOrgName } }),
    onSuccess: () => {
      toast.success("Sub-organización creada");
      setNewOrgName("");
      qc.invalidateQueries({ queryKey: ["my-enterprise"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  if (isLoading) return <div className="grid h-96 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (!data?.isEnterprise) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="font-display text-4xl">Multi-organización</h1>
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Disponible en plan Enterprise</p>
          <p className="mt-1 text-sm text-muted-foreground">Actualizá tu plan para crear sub-organizaciones y administrar usuarios por cliente.</p>
        </div>
      </div>
    );
  }

  if (!data.isRoot) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <h1 className="font-display text-4xl">Multi-organización</h1>
        <p className="mt-2 text-muted-foreground">Esta organización es parte de un grupo Enterprise administrado por otra cuenta.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="font-display text-4xl">Multi-organización</h1>
      <p className="mt-1 text-muted-foreground">Creá sub-organizaciones (clientes) y usuarios con acceso restringido a su grupo.</p>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Sub-organizaciones</h2>
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="Ej: Cliente ACME" className="w-56" />
            </div>
            <Button size="sm" disabled={!newOrgName || createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear
            </Button>
          </div>
        </div>

        <div className="mt-4 divide-y divide-border">
          {data.subOrgs.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Todavía no creaste sub-organizaciones.</p>
          )}
          {data.subOrgs.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(users ?? []).filter((u: any) => u.org_id === o.id).length} usuario(s) · creada {new Date(o.created_at).toLocaleDateString("es-AR")}
                </div>
              </div>
              <NewUserDialog subOrgId={o.id} subOrgName={o.name} onCreated={() => qc.invalidateQueries({ queryKey: ["enterprise-users"] })} />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Usuarios del grupo</h2>
        {!users?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">Sin usuarios aún.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Usuario</th><th>Sub-organización</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td className="py-2">{u.display_name}</td>
                  <td>{u.org_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Cada usuario solo ve las vacantes y candidatos de su sub-organización. Para asignar reclutadores a vacantes puntuales, abrí la vacante y usá "Asignar reclutadores".
      </p>
    </div>
  );
}

function NewUserDialog({ subOrgId, subOrgName, onCreated }: { subOrgId: string; subOrgName: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", display_name: "" });
  const createU = useServerFn(createSubOrgUser);
  const mut = useMutation({
    mutationFn: () => createU({ data: { sub_org_id: subOrgId, ...form } }),
    onSuccess: () => {
      toast.success("Usuario creado");
      setForm({ email: "", password: "", display_name: "" });
      setOpen(false);
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><UserPlus className="mr-2 h-4 w-4" /> Crear usuario</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear usuario en {subOrgName}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Nombre</Label>
            <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label>Contraseña inicial</Label>
            <Input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 caracteres" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.email || form.password.length < 8 || !form.display_name}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
