import logo from "@/assets/flux-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function FluxLogo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <img
      src={logo.url}
      alt="FLUX Talent"
      width={size}
      height={size}
      className={cn("object-contain", className)}
    />
  );
}

export function FluxWordmark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <div className={cn("flex items-center gap-2 font-semibold", className)}>
      <FluxLogo size={size} />
      <span className="tracking-tight">
        FLUX <span className="text-muted-foreground font-normal">Talent</span>
      </span>
    </div>
  );
}
