import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

/** Cambio de contraseña y de email desde Configuración. */
export function SecurityPanel() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setNewEmail(data.user?.email ?? "");
    });
  }, []);

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    const value = newEmail.trim().toLowerCase();
    if (!value || value === email.toLowerCase()) {
      toast.error(t("Ingresá un email distinto al actual."));
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser(
      { email: value },
      { emailRedirectTo: `${window.location.origin}/app/settings` },
    );
    setSavingEmail(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      t("Te enviamos un mail de confirmación. El cambio se aplica cuando lo confirmes."),
    );
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error(t("La nueva contraseña tiene que tener al menos 8 caracteres."));
      return;
    }
    if (next !== repeat) {
      toast.error(t("Las contraseñas nuevas no coinciden."));
      return;
    }
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({
      password: next,
      ...(current ? { current_password: current } : {}),
    } as any);
    setSavingPass(false);
    if (error) {
      toast.error(
        /current password/i.test(error.message)
          ? t("La contraseña actual no es correcta.")
          : error.message,
      );
      return;
    }
    setCurrent(""); setNext(""); setRepeat("");
    toast.success(t("Contraseña actualizada."));
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div>
          <h3 className="font-semibold">{t("Cambiar email")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("Vas a recibir un mail de confirmación en la nueva dirección.")}
          </p>
        </div>
        <form onSubmit={changeEmail} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sec-email-current">{t("Email actual")}</Label>
            <Input id="sec-email-current" value={email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sec-email-new">{t("Nuevo email")}</Label>
            <Input
              id="sec-email-new"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nombre@empresa.com"
            />
          </div>
          <Button type="submit" disabled={savingEmail}>
            {savingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Actualizar email")}
          </Button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div>
          <h3 className="font-semibold">{t("Cambiar contraseña")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("Usá al menos 8 caracteres. Si entrás con Google, podés crear una contraseña dejando el campo actual vacío.")}
          </p>
        </div>
        <form onSubmit={changePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sec-pass-current">{t("Contraseña actual")}</Label>
            <Input
              id="sec-pass-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sec-pass-new">{t("Nueva contraseña")}</Label>
              <Input
                id="sec-pass-new"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sec-pass-repeat">{t("Repetir contraseña")}</Label>
              <Input
                id="sec-pass-repeat"
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={savingPass}>
            {savingPass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Actualizar contraseña")}
          </Button>
        </form>
      </section>
    </div>
  );
}
