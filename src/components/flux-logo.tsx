import logo from "@/assets/flux-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function FluxLogo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <img
      src={logo.url}
      alt="FLUX Talent"
      width={size}
      height={size}
      className={cn("object-contain rounded-lg", className)}
      style={{ width: size, height: size }}
    />
  );
}
