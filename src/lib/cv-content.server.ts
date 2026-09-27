// Builds the AI message content for a CV. PDFs/images go as files; Word docs are
// converted to plain text because the AI provider rejects Word mime types.
import JSZip from "jszip";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isDocx(mime: string, path: string) {
  return mime === DOCX || /\.docx$/i.test(path);
}
function isDoc(mime: string, path: string) {
  return mime === "application/msword" || /\.doc$/i.test(path);
}

async function docxText(buf: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Legacy .doc: pull readable UTF-16LE and Latin-1 runs.
function docText(buf: Uint8Array): string {
  const runs: string[] = [];
  let cur = "";
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const c = buf[i] | (buf[i + 1] << 8);
    if ((c >= 32 && c < 0x250) || c === 10 || c === 13) cur += String.fromCharCode(c);
    else { if (cur.length >= 4) runs.push(cur); cur = ""; }
  }
  if (cur.length >= 4) runs.push(cur);
  let utf16 = runs.join("\n");
  if (utf16.replace(/\s/g, "").length < 200) {
    const latin = new TextDecoder("latin1").decode(buf).match(/[\x20-\x7E\xA0-\xFF\r\n]{4,}/g) ?? [];
    utf16 = latin.join("\n");
  }
  return utf16.replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function buildCvContent(supabase: any, path: string, prompt: string): Promise<any | null> {
  const { data, error } = await supabase.storage.from("cvs").download(path);
  if (error || !data) return null;
  const buf = new Uint8Array(await data.arrayBuffer());
  const mime = data.type || "application/pdf";

  if (isDocx(mime, path) || isDoc(mime, path)) {
    let text = "";
    try { text = isDocx(mime, path) ? await docxText(buf) : docText(buf); } catch { text = ""; }
    if (!text) return null;
    return `${prompt}\n\nTEXTO DEL CV (extraído de Word):\n${text.slice(0, 30000)}`;
  }

  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return [
    { type: "text", text: prompt },
    { type: "file", file: { filename: "cv.pdf", file_data: `data:${mime};base64,${btoa(s)}` } },
  ];
}
