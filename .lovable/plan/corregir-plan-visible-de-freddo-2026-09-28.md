# Corregir plan visible de Freddo

## Cambios
- Priorizar el plan Custom sobre la marca interna de acceso ilimitado, para que Freddo muestre “Plan Custom” y no “Admin (ilimitado)”.
- Mostrar en la tarjeta de uso la vigencia completa del plan cuando tenga una fecha de inicio y fin definida.
- Ajustar la cuenta de Freddo con vigencia desde el 28/09/2026 hasta el 31/12/2026, sin modificar sus límites ilimitados ni sus vacantes/postulaciones.
- Verificar que la pantalla muestre: “Plan Custom” y “Plan activo: del 28/09/2026 al 31/12/2026”.

## Detalles técnicos
- Corregir la resolución del nombre del plan para organizaciones Custom con acceso ilimitado.
- Utilizar la fecha de inicio del ciclo y `current_period_end` como vigencia visible.
- Actualizar únicamente los datos de suscripción de la organización Freddo.
