import { Link } from "@tanstack/react-router";
import { ArrowRight, Briefcase, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import freddoLogo from "@/assets/freddo-logo.png.asset.json";

export function FreddoEntry({ preview }: { preview: boolean }) {
  return (
    <main className="freddo-entry flex min-h-screen flex-col border-t-8 border-primary bg-background px-5 py-12 text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center">
        <img src={freddoLogo.url} alt="Freddo" className="mb-10 h-32 w-full max-w-72 object-contain sm:h-40" />
        <h1 className="text-center text-3xl font-semibold tracking-normal">Te damos la bienvenida</h1>
        <div className="mt-10 w-full max-w-xl">
          <section className="border-y border-border py-8">
            <div className="flex items-center gap-3 text-primary">
              <Briefcase className="h-6 w-6 shrink-0" />
              <h2 className="text-2xl font-semibold tracking-normal">¿Sos candidato?</h2>
            </div>
            <p className="mt-3 text-base text-muted-foreground">Ingresá al portal de vacantes para postularte.</p>
            <p className="mt-2 font-semibold text-primary">No necesitás loguearte ni crear una cuenta.</p>
            <Button asChild size="lg" className="mt-6 h-12 w-full sm:w-auto">
              {preview ? (
                <a href="/vacantes?org=freddo">Ver vacantes y postularme <ArrowRight /></a>
              ) : (
                <Link to="/vacantes">Ver vacantes y postularme <ArrowRight /></Link>
              )}
            </Button>
            <p className="mt-3 break-all text-sm text-muted-foreground">freddo.fluxtalent.com.ar/vacantes</p>
          </section>
          <section className="flex flex-wrap items-center justify-between gap-4 py-8">
            <h2 className="text-lg font-semibold tracking-normal">¿Sos colaborador?</h2>
            <Button asChild variant="outline" size="lg" className="h-11">
              <Link to="/auth"><LogIn /> Ingresar como colaborador</Link>
            </Button>
          </section>
        </div>
      </div>
      <footer className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
        © 2026 FLUX Automatizaciones. Todos los derechos reservados.
      </footer>
    </main>
  );
}
