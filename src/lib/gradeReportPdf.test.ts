import { describe, it, expect, vi, beforeEach } from "vitest";
import type { jsPDF } from "jspdf";
import type { Grade } from "./types";
import { downloadGradeReportPdf, type GradeReportData } from "./gradeReportPdf";

// Real jsPDF, but save() records the document instead of triggering a browser download
const pdfs = vi.hoisted(() => ({ saved: null as { doc: jsPDF; fileName: string } | null }));
vi.mock("jspdf", async (importOriginal) => {
  const mod = await importOriginal<typeof import("jspdf")>();
  class RecordingPDF extends mod.jsPDF {
    constructor(...args: ConstructorParameters<typeof mod.jsPDF>) {
      super(...args);
      this.save = ((fileName: string) => {
        pdfs.saved = { doc: this, fileName };
        return this;
      }) as never;
    }
  }
  return { ...mod, jsPDF: RecordingPDF };
});

beforeEach(() => {
  pdfs.saved = null;
});

const grade = (i: number, score: number): Grade =>
  ({ id: `g${i}`, course_name: `Mapel ${i}`, score, grade_letter: "A", credits: 2, student_id: "s1" }) as unknown as Grade;

const report = (grades: Grade[], over: Partial<GradeReportData> = {}): GradeReportData => ({
  grades,
  studentName: "Budi Santoso",
  className: "8",
  dateText: "21 September 2026",
  gpa: "3.70",
  totalCredits: grades.reduce((a, g) => a + Number(g.credits), 0),
  fileName: "rapor-nilai-budi-santoso.pdf",
  getStatus: s => (s >= 90 ? "excellent" : s >= 80 ? "good" : s >= 70 ? "average" : "below"),
  labels: {
    brand: "HarapanEdu", title: "Rapor Nilai", subtitle: "Tetap semangat", student: "Siswa", className: "Kelas", date: "Tanggal",
    gpa: "IPK", credits: "SKS", courses: "Mapel", avgScore: "Rata-rata", no: "No", subject: "Mata Pelajaran", score: "Skor",
    grade: "Huruf", creditsCol: "SKS", status: "Status", noGrades: "Belum ada nilai.", footer: "Terus bersinar!",
    page: (c, t) => `Halaman ${c} dari ${t}`,
    statusLabel: s => ({ excellent: "Sangat Baik", good: "Baik", average: "Cukup", below: "Kurang" })[s],
  },
  ...over,
});

const text = () => pdfs.saved!.doc.output();

describe("downloadGradeReportPdf", () => {
  it("saves an A4 report under the given file name", async () => {
    await downloadGradeReportPdf(report([grade(1, 88)]));
    expect(pdfs.saved?.fileName).toBe("rapor-nilai-budi-santoso.pdf");
    expect(pdfs.saved!.doc.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
    expect(pdfs.saved!.doc.getNumberOfPages()).toBe(1);
  });

  it("includes the student, summary and each grade with its status", async () => {
    await downloadGradeReportPdf(report([grade(1, 95), grade(2, 65)]));
    const pdf = text();
    for (const s of ["Budi Santoso", "Rapor Nilai", "21 September 2026", "3.70", "Mapel 1", "Mapel 2", "SANGAT BAIK", "KURANG", "95%", "Halaman 1 dari 1"]) {
      expect(pdf, s).toContain(s);
    }
  });

  it("continues on new pages for long reports and numbers every page", async () => {
    await downloadGradeReportPdf(report(Array.from({ length: 25 }, (_, i) => grade(i + 1, 80))));
    const pages = pdfs.saved!.doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(1);
    expect(text()).toContain(`Halaman ${pages} dari ${pages}`);
    expect(text()).toContain("Mapel 25");
  });

  it("says so when there are no grades", async () => {
    await downloadGradeReportPdf(report([]));
    expect(text()).toContain("Belum ada nilai.");
  });
});
