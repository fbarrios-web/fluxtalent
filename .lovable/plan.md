# Bloqueos en agenda de demos

## Objetivo
Permitir que los superadministradores bloqueen una fecha completa o una franja horaria para que ningún prospecto pueda reservarla.

## Cambios
- Agregar una sección **Bloqueos** en `/app/admin/demos` con fecha, opción de día completo, hora desde/hasta, motivo opcional y acción para eliminar.
- Guardar los bloqueos de forma persistente y mostrarlos al volver a ingresar al panel.
- Excluir automáticamente del enlace público todos los horarios que se superpongan con un bloqueo.
- Validar nuevamente el bloqueo al confirmar una reserva, evitando reservas simultáneas o sobre horarios recién bloqueados.
- Al regenerar la disponibilidad semanal, conservar y volver a aplicar los bloqueos existentes.

## Seguridad y reglas
- Solo usuarios con rol `admin` podrán crear o eliminar bloqueos.
- Los bloqueos no modificarán reservas ya confirmadas; la pantalla avisará si un nuevo bloqueo se superpone con una reserva existente.
- Se agregarán pruebas para comprobar que un horario bloqueado no se publique ni pueda reservarse.

## Verificación
- Ejecutar las pruebas específicas de agenda.
- Comprobar el panel de Demos y el enlace público en escritorio.
- Confirmar que el proyecto compile sin errores.
