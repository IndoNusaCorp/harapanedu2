import * as XLSX from "xlsx";
import type { Part } from "@google/genai";
import type { ServerFileRef } from "./dataContext";

// ============================================
// Membaca file dari Firebase Storage untuk dikirim ke Gemini
// ============================================
// - PDF & gambar  → dikirim apa adanya (Gemini bisa membaca langsung)
// - Teks / CSV    → dikirim sebagai teks
// - Excel         → diubah ke CSV per sheet
// - Word / PPT    → teksnya diambil dari XML di dalam file (docx/pptx adalah file zip)
// - Format lain   → hanya nama file yang dikirim

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 60_000;

const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif",
]);

const EXTENSION_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  xlsx: "xlsx",
  xls: "xlsx",
  docx: "docx",
  pptx: "pptx",
};

// Hanya URL milik bucket Firebase Storage project ini yang boleh diunduh server
export function isAllowedStorageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
    const isStorageHost = u.hostname === "firebasestorage.googleapis.com" || u.hostname.endsWith(".firebasestorage.app");
    return u.protocol === "https:" && isStorageHost && (!bucket || u.pathname.includes(bucket) || u.hostname.startsWith(bucket));
  } catch {
    return false;
  }
}

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function truncate(text: string) {
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n...[dipotong]` : text;
}

function decodeXmlText(xml: string) {
  return xml
    .replace(/<\/(w:p|a:p)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function officeToText(buffer: Buffer, kind: "docx" | "pptx"): string {
  const zip = XLSX.CFB.read(buffer, { type: "buffer" }) as { FullPaths: string[]; FileIndex: { content?: unknown }[] };
  type Entry = { path: string; content?: unknown };
  const entries: Entry[] = zip.FullPaths
    .map((path: string, i: number) => ({ path, content: zip.FileIndex[i]?.content }))
    .filter((e: Entry) => e.content && (kind === "docx"
      ? /\/word\/document\.xml$/.test(e.path)
      : /\/ppt\/slides\/slide\d+\.xml$/.test(e.path)));

  // Urutkan slide sesuai nomor (slide2 sebelum slide10)
  const slideNo = (p: string) => Number(p.match(/slide(\d+)\.xml$/)?.[1] || 0);
  entries.sort((a, b) => slideNo(a.path) - slideNo(b.path));

  return entries
    .map((e, i) => {
      const text = decodeXmlText(Buffer.from(e.content as Uint8Array).toString("utf8"));
      return kind === "pptx" ? `[Slide ${i + 1}]\n${text}` : text;
    })
    .join("\n\n");
}

export function spreadsheetToText(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: "buffer" });
  return wb.SheetNames.map(name => `[Sheet ${name}]\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`).join("\n\n");
}

export async function fileToParts(file: ServerFileRef): Promise<Part[]> {
  const header: Part = { text: `--- FILE: "${file.name}" (${file.label}) ---` };
  const unreadable = (reason: string): Part[] => [header, { text: `[File tidak bisa dibaca: ${reason}]` }];

  if (!isAllowedStorageUrl(file.url)) return unreadable("lokasi file tidak valid");

  try {
    const res = await fetch(file.url, { cache: "no-store" });
    if (!res.ok) return unreadable(`gagal diunduh (${res.status})`);

    const size = Number(res.headers.get("content-length") || 0);
    if (size > MAX_FILE_BYTES) return unreadable("ukuran file lebih dari 15 MB");

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_FILE_BYTES) return unreadable("ukuran file lebih dari 15 MB");

    const headerType = (res.headers.get("content-type") || "").split(";")[0].trim();
    const type = INLINE_TYPES.has(headerType) || headerType.startsWith("text/")
      ? headerType
      : EXTENSION_TYPES[extensionOf(file.name)] || headerType;

    if (INLINE_TYPES.has(type)) {
      return [header, { inlineData: { mimeType: type, data: buffer.toString("base64") } }];
    }
    if (type.startsWith("text/")) return [header, { text: truncate(buffer.toString("utf8")) }];
    if (type === "xlsx") return [header, { text: truncate(spreadsheetToText(buffer)) }];
    if (type === "docx" || type === "pptx") return [header, { text: truncate(officeToText(buffer, type)) }];

    return unreadable(`format ${extensionOf(file.name) || headerType} belum didukung`);
  } catch (e) {
    console.warn("fileToParts gagal:", file.name, e);
    return unreadable("terjadi kesalahan saat membaca file");
  }
}

export async function filesToParts(files: ServerFileRef[]): Promise<Part[]> {
  const parts = await Promise.all(files.map(fileToParts));
  return parts.flat();
}
