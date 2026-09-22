import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { seedFirestore } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import KidsGrades from "./KidsGrades";

const pdf = vi.hoisted(() => ({ download: vi.fn(async (_data: any) => {}) }));
vi.mock("@/lib/gradeReportPdf", () => ({ downloadGradeReportPdf: pdf.download }));

const withGrades = () => {
  const who = loginAs("s1", "/grades");
  seedFirestore({
    grades: {
      k1: { student_id: "s1", course_name: "Matematika", score: 95, grade_letter: "A", credits: 2, created_at: "2026-09-18T00:00:00Z" },
      k2: { student_id: "s1", course_name: "Bahasa", score: 72, grade_letter: "C", credits: 2, created_at: "2026-09-19T00:00:00Z" },
    },
  });
  return who;
};
const row = (course: string) => screen.getByRole("heading", { name: course }).closest("div.grid") as HTMLElement;

describe("KidsGrades", () => {
  it("shows the child's grades with a friendly status", async () => {
    await renderWithProviders(<KidsGrades />, withGrades());
    await screen.findByRole("heading", { name: "Matematika" });

    expect(within(row("Matematika")).getByText("Sangat Bagus")).toBeInTheDocument();
    expect(within(row("Matematika")).getByText("95")).toBeInTheDocument();
    expect(within(row("Bahasa")).getByText("Cukup")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "IPA" })).toBeNull(); // not Budi's
  });

  it("formats the GPA for the child's language", async () => {
    await renderWithProviders(<KidsGrades />, withGrades());
    // (4.0 × 2 + 2.7 × 2) / 4 = 3.35, written with a comma in Indonesian
    expect(await screen.findByText("3,35")).toBeInTheDocument();
    expect(screen.getByText("Total Kelas").nextSibling).toHaveTextContent("4");
  });

  it("downloads the kids report card", async () => {
    await renderWithProviders(<KidsGrades />, withGrades());
    await screen.findByRole("heading", { name: "Matematika" });
    fireEvent.click(screen.getByRole("button", { name: "Unduh rapor" }));

    await waitFor(() => expect(pdf.download).toHaveBeenCalled());
    const data = pdf.download.mock.calls[0][0];
    expect(data).toMatchObject({ studentName: "Ani Putri", fileName: "rapor-nilai-ani-putri.pdf", gpa: "3,35" });
    expect(data.labels.title).toBe("Rapor Anak Hebat");
    expect(data.labels.statusLabel("excellent")).toBe("Sangat Bagus");
  });

  it("encourages the child when there are no grades yet", async () => {
    await renderWithProviders(<KidsGrades />, loginAs("s1", "/grades"));
    expect(await screen.findByText("Belum ada nilai nih!")).toBeInTheDocument();
    expect(screen.getByText("0,00")).toBeInTheDocument();
  });
});
