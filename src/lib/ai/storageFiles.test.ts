import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";
import { stubNetwork } from "@/test/ai";
import { fileToParts, isAllowedStorageUrl, officeToText, spreadsheetToText } from "./storageFiles";
import type { ServerFileRef } from "./dataContext";


function makeZip(files: Record<string, string>) {
  const cfb = XLSX.CFB.utils.cfb_new();
  for (const [path, content] of Object.entries(files)) {
    XLSX.CFB.utils.cfb_add(cfb, path, Buffer.from(content));
  }
  return Buffer.from(XLSX.CFB.write(cfb, { type: "buffer", fileType: "zip" }) as Uint8Array);
}

describe("isAllowedStorageUrl", () => {
  it("only allows https download URLs from this project's bucket", () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "demo.firebasestorage.app");
    expect(isAllowedStorageUrl("https://firebasestorage.googleapis.com/v0/b/demo.firebasestorage.app/o/a.pdf?alt=media")).toBe(true);
    expect(isAllowedStorageUrl("https://firebasestorage.googleapis.com/v0/b/other-bucket/o/a.pdf")).toBe(false);
    expect(isAllowedStorageUrl("http://firebasestorage.googleapis.com/v0/b/demo.firebasestorage.app/o/a.pdf")).toBe(false);
    expect(isAllowedStorageUrl("https://evil.example.com/demo.firebasestorage.app/a.pdf")).toBe(false);
    expect(isAllowedStorageUrl("not a url")).toBe(false);
  });
});

describe("office file extraction", () => {
  it("extracts paragraph text from a docx", () => {
    const zip = makeZip({ "word/document.xml": "<w:p><w:t>Halo &amp; selamat</w:t></w:p><w:p><w:t>Dunia</w:t></w:p>" });
    expect(officeToText(zip, "docx")).toBe("Halo & selamat\nDunia");
  });

  it("extracts pptx slides in numeric order", () => {
    const zip = makeZip({
      "ppt/slides/slide10.xml": "<a:p><a:t>Sepuluh</a:t></a:p>",
      "ppt/slides/slide2.xml": "<a:p><a:t>Dua</a:t></a:p>",
    });
    expect(officeToText(zip, "pptx")).toBe("[Slide 1]\nDua\n\n[Slide 2]\nSepuluh");
  });

  it("converts spreadsheets to csv per sheet", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Nama", "Nilai"], ["Ani", 90]]), "Nilai");
    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    expect(spreadsheetToText(buffer)).toBe("[Sheet Nilai]\nNama,Nilai\nAni,90");
  });
});

describe("fileToParts", () => {
  const BUCKET_URL = "https://firebasestorage.googleapis.com/v0/b/demo-harapanedu.firebasestorage.app/o/";
  const file = (name: string, url = `${BUCKET_URL}${name}?alt=media`): ServerFileRef =>
    ({ id: `class_materi:${name}`, name, url, kind: "class_materi", label: "Matematika" });

  it("never downloads files outside this project's bucket", async () => {
    const fetchMock = stubNetwork();
    const parts = await fileToParts(file("a.pdf", "https://evil.example.com/a.pdf"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(parts[1]).toEqual({ text: "[File tidak bisa dibaca: lokasi file tidak valid]" });
  });

  it("sends PDFs inline and text files as text", async () => {
    const pdf = file("bab1.pdf");
    const txt = file("catatan.txt");
    stubNetwork({ [pdf.url]: { body: "%PDF-1.4", type: "application/pdf" }, [txt.url]: { body: "isi catatan", type: "text/plain; charset=utf-8" } });

    expect(await fileToParts(pdf)).toEqual([
      { text: '--- FILE: "bab1.pdf" (Matematika) ---' },
      { inlineData: { mimeType: "application/pdf", data: Buffer.from("%PDF-1.4").toString("base64") } },
    ]);
    expect((await fileToParts(txt))[1]).toEqual({ text: "isi catatan" });
  });

  it("uses the file extension when Storage reports a generic type", async () => {
    const docx = file("tugas.docx");
    const zip = makeZip({ "word/document.xml": "<w:p><w:t>Jawaban saya</w:t></w:p>" });
    stubNetwork({ [docx.url]: { body: new Uint8Array(zip), type: "application/octet-stream" } });
    expect((await fileToParts(docx))[1]).toEqual({ text: "Jawaban saya" });
  });

  it("reports missing, oversized and unsupported files as unreadable", async () => {
    const missing = file("hilang.pdf");
    const big = file("besar.txt");
    const zip = file("arsip.zip");
    stubNetwork({
      [big.url]: { body: new Uint8Array(15 * 1024 * 1024 + 1), type: "text/plain" },
      [zip.url]: { body: "PK", type: "application/zip" },
    });

    expect((await fileToParts(missing))[1]).toEqual({ text: "[File tidak bisa dibaca: gagal diunduh (404)]" });
    expect((await fileToParts(big))[1]).toEqual({ text: "[File tidak bisa dibaca: ukuran file lebih dari 15 MB]" });
    expect((await fileToParts(zip))[1]).toEqual({ text: "[File tidak bisa dibaca: format zip belum didukung]" });
  });
});
