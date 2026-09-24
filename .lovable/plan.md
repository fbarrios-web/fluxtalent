# Plan: columna Leídos, notas y resumen de la vacante

## Resultado
- Agregar **Leídos** inmediatamente después de **Recibidos** en el tablero de postulantes.
- Mover automáticamente un CV de Recibidos a Leídos cuando un reclutador abre su ficha, sin cambiar postulantes que ya avanzaron a otra etapa.
- Incorporar en la ficha del postulante un espacio simple para guardar notas u observaciones internas.
- Ampliar el encabezado del formulario público con un resumen ordenado de la vacante: descripción, requisitos excluyentes, deseables, seniority, modalidad, ubicación y días/horarios.

## Implementación
1. Ampliar la etapa de postulaciones con el estado `read` y agregar un campo de observaciones a cada postulación.
2. Actualizar las acciones protegidas para marcar como leído, registrar el cambio en el historial y guardar observaciones.
3. Añadir la columna **Leídos** al tablero y el nuevo estado a todos los selectores y etiquetas relacionados.
4. Añadir el editor de notas en la ficha del postulante, con guardado claro y confirmación.
5. Mostrar los datos de la vacante en el formulario público con secciones breves y fáciles de escanear.
6. Completar las traducciones al inglés y validar el recorrido en escritorio y celular.

## Detalles técnicos
- La transición automática será únicamente `received → read`; abrir una ficha nunca hará retroceder otra etapa.
- Las observaciones serán privadas para usuarios de la misma organización mediante las reglas actuales de acceso a postulaciones.
- El historial registrará el paso automático a Leídos para mantener trazabilidad.
- No se modificarán precios, límites, emails ni reglas de descarte.
