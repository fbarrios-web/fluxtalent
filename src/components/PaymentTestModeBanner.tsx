import { getPaddleEnvironment } from "@/lib/paddle";

export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full border-b border-orange-300 bg-orange-100 px-4 py-2 text-center text-sm text-orange-800">
      Los pagos en USD dentro del preview están en modo de prueba. Usá tarjetas de test (ej. 4242 4242 4242 4242).
    </div>
  );
}
