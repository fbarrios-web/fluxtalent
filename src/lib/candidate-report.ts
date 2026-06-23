import {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType, Table, TableRow, TableCell,
  WidthType, PageOrientation,
} from "docx";
import { supabase } from "@/integrations/supabase/client";

async function fetchLogoBytes(path: string | null | undefined): Promise<{ bytes: Uint8Array; ext: "png" | "jpg" } | null> {
  if (!path) return null;
  try {
    let url = path;
    if (!path.startsWith("http")) {
      const { data } = await supabase.storage.from("org-assets").createSignedUrl(path, 600);
      if (!data?.signedUrl) return null;
      url = data.signedUrl;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const lower = path.toLowerCase();
    const ext: "png" | "jpg" = lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "jpg" : "png";
    return { bytes: buf, ext };
  } catch { return null; }
}

function hexToRgb(hex: string) {
  const m = hex.replace("#", "").padEnd(6, "0");
  return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) };
}

function P(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 22, color: opts.color, font: "Arial" })],
    spacing: { after: 80 },
  });
}

function H(text: string, color: string, level: 1 | 2 = 2) {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: color.replace("#", ""), font: "Arial", size: level === 1 ? 36 : 26 })],
    border: level === 2 ? { bottom: { color: color.replace("#", ""), space: 4, style: BorderStyle.SINGLE, size: 8 } } : undefined,
  });
}

function bullets(items: string[], color: string) {
  if (!items?.length) return [P("—")];
  return items.map(t => new Paragraph({
    spacing: { after: 60 },
    indent: { left: 360 },
    children: [
      new TextRun({ text: "• ", bold: true, color: color.replace("#", ""), font: "Arial", size: 22 }),
      new TextRun({ text: t, size: 22, font: "Arial" }),
    ],
  }));
}

function kvTable(rows: Array<[string, string]>, color: string) {
  const { r, g, b } = hexToRgb(color);
  const tint = `${(0xff - Math.round((0xff - r) * 0.85)).toString(16).padStart(2, "0")}${(0xff - Math.round((0xff - g) * 0.85)).toString(16).padStart(2, "0")}${(0xff - Math.round((0xff - b) * 0.85)).toString(16).padStart(2, "0")}`;
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows: rows.map(([k, v]) => new TableRow({
      children: [
        new TableCell({
          width: { size: 2800, type: WidthType.DXA },
          shading: { fill: tint, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 20, font: "Arial" })] })],
        }),
        new TableCell({
          width: { size: 6560, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: v || "—", size: 22, font: "Arial" })] })],
        }),
      ],
    })),
  });
}

export type InterviewAnalysis = {
  summary: string;
  alignment_score: number;
  strengths: string[];
  concerns: string[];
  evidence: Array<{ topic: string; quote: string; insight: string }>;
  recommendation: "avanzar" | "stand_by" | "descartar";
  next_steps: string[];
};

export type CandidateReportInput = {
  org: { name?: string | null; consultancy_name?: string | null; logo_url?: string | null; brand_color?: string | null };
  candidate: any;
  vacancy: { title?: string | null };
  analysis?: InterviewAnalysis | null;
};

export async function generateCandidateReport({ org, candidate, vacancy, analysis }: CandidateReportInput) {
  const color = org.brand_color || "#0F766E";
  const logo = await fetchLogoBytes(org.logo_url);
  const headerName = org.consultancy_name || org.name || "Informe del candidato";

  const headerChildren: Paragraph[] = [];
  if (logo) {
    headerChildren.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new ImageRun({
        type: logo.ext === "jpg" ? "jpg" : "png",
        data: logo.bytes,
        transformation: { width: 120, height: 60 },
        altText: { title: "Logo", description: "Logo", name: "logo" },
      })],
    }));
  }
  headerChildren.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 200 },
    children: [new TextRun({ text: headerName, bold: true, color: color.replace("#", ""), size: 20, font: "Arial" })],
  }));

  const fullName = `${candidate.first_name ?? ""} ${candidate.last_name ?? ""}`.trim() || "Candidato";
  const breakdown = candidate.match_breakdown ?? {};

  const children: (Paragraph | Table)[] = [
    ...headerChildren,
    H(`Informe — ${fullName}`, color, 1),
    P(`Posición: ${vacancy.title ?? "—"}`, { bold: true }),
    P(`Generado: ${new Date().toLocaleString("es-AR")}`, { color: "666666", size: 18 }),

    H("Datos de contacto", color),
    kvTable([
      ["Email", candidate.email ?? "—"],
      ["Teléfono", candidate.phone ?? "—"],
      ["LinkedIn", candidate.linkedin ?? "—"],
      ["Etapa actual", candidate.stage ?? "—"],
      ["Match score", candidate.match_score != null ? `${candidate.match_score}%` : "—"],
    ], color),

    H("Resumen de IA", color),
    P(candidate.ai_summary || "Sin análisis IA disponible."),
  ];

  if (Object.keys(breakdown).length) {
    children.push(H("Desglose del match", color));
    children.push(kvTable(Object.entries(breakdown).map(([k, v]) => [k, `${v}%`]), color));
  }

  if (candidate.strengths?.length) {
    children.push(H("Fortalezas", color));
    children.push(...bullets(candidate.strengths, color));
  }
  if (candidate.gaps?.length) {
    children.push(H("Gaps", color));
    children.push(...bullets(candidate.gaps, color));
  }
  if (candidate.red_flags?.length) {
    children.push(H("Red flags", color));
    children.push(...bullets(candidate.red_flags, color));
  }

  if (analysis) {
    children.push(H("Análisis de la entrevista", color));
    children.push(kvTable([
      ["Alineación con vacante", `${analysis.alignment_score}%`],
      ["Recomendación", analysis.recommendation.toUpperCase()],
    ], color));
    children.push(P(analysis.summary));

    if (analysis.strengths?.length) {
      children.push(H("Lo observado a favor", color));
      children.push(...bullets(analysis.strengths, color));
    }
    if (analysis.concerns?.length) {
      children.push(H("Puntos de atención", color));
      children.push(...bullets(analysis.concerns, color));
    }
    if (analysis.evidence?.length) {
      children.push(H("Evidencia de la entrevista", color));
      for (const ev of analysis.evidence) {
        children.push(P(ev.topic, { bold: true }));
        children.push(P(`"${ev.quote}"`, { color: "555555" }));
        children.push(P(ev.insight));
      }
    }
    if (analysis.next_steps?.length) {
      children.push(H("Próximos pasos sugeridos", color));
      children.push(...bullets(analysis.next_steps, color));
    }
  }


  const doc = new Document({
    creator: headerName,
    title: `Informe ${fullName}`,
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = fullName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Informe_${safeName}.docx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
