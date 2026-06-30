import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { saveIdentity } from "@/lib/recruiting.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { FluxLogo } from "@/components/flux-logo";


export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Ingresar — FLUX Talent" }] }),
});

function AuthPage() {
  const nav = useNavigate();
  const saveId = useServerFn(saveIdentity);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [dniError, setDniError] = useState<string | null>(null);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Te enviamos un email para recuperar tu contraseña.");
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err: any) {
      toast.error(err.message ?? "No se pudo enviar el email");
    } finally {
      setForgotLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/app/dashboard" });
    });
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        // Anti-abuse: identity uniqueness is enforced by saveIdentity (DB unique constraint)
        // after the session exists. We avoid pre-checking pre-signup to prevent enumeration.
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/app/dashboard`,
            data: { org_name: orgName || "Mi empresa", display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        // Save identity now that the session exists (signup auto-signs-in when auto-confirm is on).
        try { await saveId({ data: { dni: dni.trim(), full_name: fullName.trim(), birth_date: birthDate } }); } catch {}
        toast.success("¡Cuenta creada!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav({ to: "/app/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/app/dashboard`,
      });
      if (result.error) throw result.error instanceof Error ? result.error : new Error(String(result.error));
      if (!result.redirected) nav({ to: "/app/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Error con Google");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground md:flex">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-foreground p-1.5">
            <FluxLogo size={24} />
          </div>
          FLUX <span className="opacity-70 font-normal">Talent</span>
        </Link>
        <div>
          <p className="font-display text-4xl leading-tight">
            "Reducimos los tiempos de contratación de 30 días a menos de 7 días con FLUX Talent."
          </p>
          <p className="mt-4 text-sm opacity-80">— Lucía Méndez, Head of People @Inventia</p>
        </div>
        <p className="text-xs opacity-60">© 2026 FLUX Automatizaciones. Todos los derechos reservados.</p>
      </div>


      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl">{mode === "signin" ? "Bienvenido de vuelta" : "Creá tu cuenta"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Ingresá para gestionar tus búsquedas." : "Activá tu workspace en menos de 1 minuto."}
          </p>

          <Button onClick={handleGoogle} variant="outline" className="mt-6 w-full" disabled={loading}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuar con Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> o con email <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="org">Empresa</Label>
                  <Input id="org" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Acme Inc." required />
                </div>
                <div>
                  <Label htmlFor="name">Nombre para mostrar</Label>
                  <Input id="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="María" required />
                </div>
                <div>
                  <Label htmlFor="fullname">Nombre y apellido completo</Label>
                  <Input id="fullname" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="María Pérez González" required minLength={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="dni">DNI</Label>
                    <Input id="dni" value={dni} onChange={e => setDni(e.target.value)} placeholder="30123456" required minLength={6} />
                  </div>
                  <div>
                    <Label htmlFor="bday">Fecha de nac.</Label>
                    <Input id="bday" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} required />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                {mode === "signin" && (
                  <button type="button" onClick={() => { setForgotEmail(email); setForgotOpen(true); }} className="text-xs font-medium text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="pr-10" />
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-medium text-primary hover:underline">
              {mode === "signin" ? "Crear una" : "Ingresar"}
            </button>
          </p>
        </div>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !forgotLoading && setForgotOpen(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={handleForgotPassword} className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-lg">
            <h2 className="font-display text-2xl">Recuperar contraseña</h2>
            <p className="mt-1 text-sm text-muted-foreground">Te enviaremos un email con un enlace para restablecerla.</p>
            <div className="mt-4">
              <Label htmlFor="forgot-email">Email</Label>
              <Input id="forgot-email" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)} disabled={forgotLoading}>Cancelar</Button>
              <Button type="submit" disabled={forgotLoading || !forgotEmail}>
                {forgotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar email
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
