# API de candidatos contratados

Esta integración solo consulta la organización de `fbarrios@fluxtalent.com.ar`. No crea postulaciones, no genera nuevos análisis y no permite consultar otras cuentas.

- Método: `GET`
- URL después de publicar: `https://fluxtalent.com.ar/api/hired-candidates`
- Cabecera obligatoria: `X-API-Key` con el valor guardado en `HIRED_CANDIDATES_API_KEY`. No enviar claves en la URL ni desde código público del navegador.
- Parámetros opcionales: `limit` (1 a 100, por defecto 50) y `cursor` (valor de `siguiente_cursor` de la respuesta anterior).
- La protección de acceso del sitio publicado, si está activada, sigue aplicándose a esta URL; no se ha desactivado para esta integración.

## Ejemplo de respuesta (datos ficticios)

```json
{
  "candidatos": [{
    "id": "identificador-de-postulacion",
    "vacante_id": "identificador-de-vacante",
    "nombre": "Ana",
    "apellido": "Ejemplo",
    "contacto": { "email": "ana@example.test", "telefono": "12345678", "linkedin": null },
    "contratado_desde": "2026-11-12T10:00:00Z",
    "resumen_informe": "Resumen del informe de IA ya guardado"
  }],
  "cantidad": 1,
  "siguiente_cursor": null
}
```

`contratado_desde` se obtiene del historial de cambios: inicio del tramo actual en Contratado, en formato ISO/UTC. Si no hay historial disponible se devuelve `null`, nunca la fecha de postulación o de última edición. El resumen y los contactos también pueden ser `null` si no se guardaron. `cantidad` corresponde a esta página, no a un total histórico.

Respuestas: 401 clave ausente/incorrecta; 400 parámetros inválidos; 503 clave no configurada o cuenta desvinculada; 500 error de consulta. Todas impiden almacenar la respuesta en caché.