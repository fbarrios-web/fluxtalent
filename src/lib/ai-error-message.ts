// Translates raw analysis errors (ai_last_error) into clear Spanish for recruiters.
export function describeAiError(raw?: string | null): { short: string; detail: string } {
  const m = (raw ?? "").toLowerCase();
  if (!m) return { short: "No se pudo analizar", detail: "El análisis no pudo completarse. Tocá \"Analizar ahora\" para reintentar." };
  if (m.includes("pausado") || m.includes("credit") || m.includes("402") || m.includes("not enough"))
    return { short: "En pausa", detail: "Análisis en pausa por límite de consumo de IA. Se reanudará automáticamente." };
  if (m.includes("mime") || m.includes("unsupported") || m.includes("no soportado") || m.includes("format"))
    return { short: "Formato de CV no legible", detail: "El formato del archivo no se puede leer. Pedile al postulante el CV en PDF o Word (.docx)." };
  if (m.includes("password") || m.includes("encrypt") || m.includes("protegido"))
    return { short: "CV protegido", detail: "El archivo tiene contraseña o está protegido. Pedile al postulante una versión sin protección." };
  if (m.includes("empty") || m.includes("vacío") || m.includes("no text") || m.includes("sin texto"))
    return { short: "CV sin texto", detail: "El CV no tiene texto legible (puede ser una imagen o estar vacío). Pedile una versión en PDF con texto." };
  if (m.includes("download") || m.includes("storage") || m.includes("object not found") || m.includes("not found"))
    return { short: "Archivo no disponible", detail: "No se encontró el archivo del CV. Pedile al postulante que lo vuelva a enviar." };
  if (m.includes("too large") || m.includes("413") || m.includes("token") || m.includes("too long"))
    return { short: "CV demasiado extenso", detail: "El CV es demasiado extenso o pesado para analizarlo. Pedí una versión más corta." };
  if (m.includes("400"))
    return { short: "CV no procesable", detail: "El contenido del CV no pudo ser interpretado. Revisalo manualmente o pedí otra versión." };
  if (m.includes("429") || m.includes("5") && /ai 5\d\d/.test(m) || m.includes("timeout") || m.includes("fetch"))
    return { short: "Reintentando", detail: "Hubo una demora temporal del servicio de análisis. Tocá \"Analizar ahora\" para reintentar." };
  if (m.includes("invalid json"))
    return { short: "Respuesta incompleta", detail: "El análisis devolvió una respuesta incompleta. Tocá \"Analizar ahora\" para reintentar." };
  return { short: "No se pudo analizar", detail: `El análisis no pudo completarse (${raw!.slice(0, 160)}). Tocá "Analizar ahora" para reintentar.` };
}
