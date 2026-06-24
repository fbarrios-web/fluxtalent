import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { FluxLogo } from "@/components/flux-logo";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Restablecer contraseña — FLUX Talent" }] }),
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase handles the recovery token via the auth state change.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Las contraseñas no coinciden"); return; }
    if (password.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      nav({ to: "/app/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "No se pudo actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2 font-semibold">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary p-1.5">
            <FluxLogo size={24} />
          </div>
          FLUX <span className="opacity-70 font-normal">Talent</span>
        </Link>
        <h1 className="font-display text-3xl">Restablecer contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready ? "Ingresá tu nueva contraseña." : "Validando enlace..."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="pr-10" disabled={!ready} />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <Input id="confirm" type={showPassword ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} disabled={!ready} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !ready}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar nueva contraseña
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="font-medium text-primary hover:underline">Volver al login</Link>
        </p>
      </div>
    </div>
  );
}
