import { describe, it, expect, vi, afterEach } from "vitest";
import * as XLSX from "xlsx";
import { isAllowedStorageUrl, officeToText, spreadsheetToText } from "./storageFiles";

afterEach(() => vi.unstubAllEnvs());

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
