import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc, seedFirestore } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import GradesPage from "./page";

const pdf = vi.hoisted(() => ({ download: vi.fn(async (_data: unknown) => {}) }));
vi.mock("@/lib/gradeReportPdf", () => ({ downloadGradeReportPdf: pdf.download }));

const open = (who: "s1" | "s2" | "t1") => renderWithProviders(<GradesPage />, loginAs(who, "/grades"));
const stat = (label: string) => screen.getByText(label).parentElement!;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Grades page: student", () => {
  it("uses the kids view for elementary students", async () => {
    await open("s1");
    expect(await screen.findByText("Daftar nilai pelajaran")).toBeInTheDocument();
  });

  it("shows the student's own grades with GPA and credits", async () => {
    seedFirestore({ grades: { other: { student_id: "s9", course_name: "Seni", score: 40, credits: 2, created_at: "2026-09-18T00:00:00Z" } } });
    await open("s2");

    expect(await screen.findByRole("heading", { name: "Matematika" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Seni" })).toBeNull();
    expect(within(stat("IPK Kumulatif")).getByText("3.70")).toBeInTheDocument();
    expect(within(stat("Total SKS")).getByText("3")).toBeInTheDocument();
    const row = screen.getByRole("heading", { name: "Matematika" }).closest("div.grid") as HTMLElement;
    expect(within(row).getByText("Baik")).toBeInTheDocument();
    expect(within(row).getByText("B+")).toBeInTheDocument();
    expect(within(row).getByText("88%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah Nilai" })).toBeNull();
  });

  it("downloads a transcript named after the student", async () => {
    await open("s2");
    await screen.findByRole("heading", { name: "Matematika" });
    fireEvent.click(screen.getByRole("button", { name: "Unduh" }));

    await waitFor(() => expect(pdf.download).toHaveBeenCalled());
    expect(pdf.download.mock.calls[0][0]).toMatchObject({
      studentName: "Budi Santoso",
      className: "8",
      gpa: "3.70",
      totalCredits: 3,
      fileName: "rapor-nilai-budi-santoso.pdf",
      grades: [expect.objectContaining({ course_name: "Matematika", score: 88 })],
    });
  });

  it("links to the AI grade helper", async () => {
    await open("s2");
    expect(await screen.findByRole("link", { name: /Asisten Nilai AI/ })).toHaveAttribute("href", "/id/pelajar/s2/grades/ai-grades-helper");
  });
});

describe("Grades page: teacher", () => {
  it("lists each student's GPA", async () => {
    await open("t1");
    expect(await screen.findByRole("heading", { name: "IPK Siswa" })).toBeInTheDocument();
    const row = screen.getByRole("heading", { name: "Budi Santoso" }).closest("div.grid") as HTMLElement;
    expect(within(row).getByText("IPK Kumulatif 3.70")).toBeInTheDocument();
    expect(within(row).getByText("Total 3 SKS")).toBeInTheDocument();
  });

  it("edits a grade from the manage list", async () => {
    await open("t1");
    await screen.findByRole("heading", { name: "Budi Santoso" });
    fireEvent.click(screen.getByRole("button", { name: "Ubah" }));
    expect(screen.getByRole("heading", { name: "Kelola Nilai" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Ubah" }).at(-1)!); // the grade's own edit button

    fireEvent.change(screen.getByPlaceholderText("95"), { target: { value: "91" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(getFirestoreDoc("grades/g1")).toMatchObject({ score: 91, student_id: "s2" }));
  });

  it("deletes a grade after confirmation and reopens the student's work for grading", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await open("t1");
    await screen.findByRole("heading", { name: "Budi Santoso" });
    fireEvent.click(screen.getByRole("button", { name: "Hapus" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Hapus" }).at(-1)!);

    await waitFor(() => expect(getFirestoreDoc("grades/g1")).toBeUndefined());
    expect(getFirestoreDoc("assignment_submissions/a1_s2")?.status).toBe("submitted");
    expect(await screen.findByText("Nilai tidak ditemukan.")).toBeInTheDocument();
  });

  // KNOWN BUG: "Tambah Nilai" opens the grade form without any way to pick a student, so the grade is saved
  // without student_id and its "grade received" notification goes to every student.
  it.fails("records which student a grade added here belongs to", async () => {
    await open("t1");
    await screen.findByRole("heading", { name: "Budi Santoso" });
    fireEvent.click(screen.getByRole("button", { name: "Tambah Nilai" }));
    fireEvent.change(screen.getByPlaceholderText("mis. Sejarah Indonesia"), { target: { value: "IPA" } });
    fireEvent.change(screen.getByPlaceholderText("95"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Nilai" }));

    await waitFor(() => expect(Object.keys(getFirestoreData("grades"))).toHaveLength(2));
    const added = Object.values(getFirestoreData("grades")).find(g => g.course_name === "IPA")!;
    expect(added.student_id).toBeTruthy();
  });
});
