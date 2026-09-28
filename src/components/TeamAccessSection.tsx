import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTeamMembers, createTeamMember, updateTeamMemberAccess } from "@/lib/enterprise.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Pencil, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

type Vac = { id: string; title: string; status: string };
type Member = { id: string; name: string; email: string; is_me: boolean; all_vacancies: boolean; vacancy_ids: string[] };

export function TeamAccessSection() {
  const t = useT();
  const qc = useQueryClient();
  const list = useServerFn(listTeamMembers);
  const { data, isLoading, error } = useQuery({ queryKey: ["team-members"], queryFn: () => list(), retry: false });
  const [editing, setEditing] = useState<Member | "new" | null>(null);

  if (error) return null;
  const vacTitle = new Map((data?.vacancies ?? []).map((v: Vac) => [v.id, v.title]));

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> {t("Usuarios y vacantes asignadas")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("Dá de alta usuarios y elegí si ven todas las vacantes o solo algunas.")}</p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}><UserPlus className="mr-2 h-4 w-4" /> {t("Nuevo usuario")}</Button>
      </div>

      {isLoading ? (
        <div className="grid h-24 place-items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {(data?.members ?? []).map((m: Member) => (
            <div key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="font-medium">{m.name} {m.is_me && <span className="text-xs text-muted-foreground">({t("vos")})</span>}</div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
                <div className="mt-1 text-xs">
                  {m.all_vacancies
                    ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{t("Todas las vacantes")}</span>
                    : <span className="text-muted-foreground">{m.vacancy_ids.map(id => vacTitle.get(id)).filter(Boolean).join(" · ") || t("Sin vacantes asignadas")}</span>}
                </div>
              </div>
              {!m.is_me && (
                <Button variant="outline" size="sm" onClick={() => setEditing(m)}><Pencil className="mr-2 h-3.5 w-3.5" /> {t("Editar acceso")}</Button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <AccessDialog
          member={editing === "new" ? null : editing}
          vacancies={data?.vacancies ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["team-members"] }); }}
        />
      )}
    </section>
  );
}

function AccessDialog({ member, vacancies, onClose, onSaved }: { member: Member | null; vacancies: Vac[]; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const create = useServerFn(createTeamMember);
  const update = useServerFn(updateTeamMemberAccess);
  const [form, setForm] = useState({ display_name: "", email: "", password: "" });
  const [all, setAll] = useState(member?.all_vacancies ?? true);
  const [selected, setSelected] = useState<string[]>(member?.vacancy_ids ?? []);

  const mut = useMutation({
    mutationFn: () => member
      ? update({ data: { user_id: member.id, all_vacancies: all, vacancy_ids: selected } })
      : create({ data: { ...form, all_vacancies: all, vacancy_ids: selected } }),
    onSuccess: () => { toast.success(member ? t("Acceso actualizado") : t("Usuario creado")); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? t("Error")),
  });

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const valid = (all || selected.length > 0) && (member || (form.display_name && form.email && form.password.length >= 8));

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{member ? t("Acceso de {name}", { name: member.name }) : t("Nuevo usuario")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {!member && (
            <>
              <div><Label>{t("Nombre")}</Label><Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} /></div>
              <div><Label>{t("Email")}</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>{t("Contraseña inicial")}</Label><Input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={t("Min 8 caracteres")} /></div>
            </>
          )}
          <div>
            <Label>{t("¿Qué vacantes puede ver?")}</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button type="button" variant={all ? "default" : "outline"} onClick={() => setAll(true)}>{t("Todas")}</Button>
              <Button type="button" variant={!all ? "default" : "outline"} onClick={() => setAll(false)}>{t("Solo algunas")}</Button>
            </div>
          </div>
          {!all && (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {vacancies.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t("Todavía no hay vacantes.")}</p>}
              {vacancies.map(v => (
                <label key={v.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <Checkbox checked={selected.includes(v.id)} onCheckedChange={() => toggle(v.id)} />
                  <span className="flex-1">{v.title}</span>
                  <span className="text-xs text-muted-foreground">{v.status}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("Cancelar")}</Button>
          <Button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("Guardar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
