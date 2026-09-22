import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreData, signInAs } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import type { AiGradeResult, AiSubmissionItem } from "@/lib/types";
import { ScorpioGradingModal } from "./ScorpioGradingModal";

const sub = (id: string, over: Partial<AiSubmissionItem> = {}): AiSubmissionItem => ({
  submission_id: id, student_id: `s-${id}`, student_name: `Siswa ${id}`, assignment_id: "a1",
  assignment_title: "PR Pecahan", course_name: "Matematika", class_id: "c1",
  file_name: `${id}.pdf`, submitted_at: "2026-09-10T00:00:00Z", is_late: false, already_graded: false, ...over,
});
const result = (id: string, score: number): AiGradeResult => ({
  submission_id: id, student_id: `s-${id}`, student_name: `Siswa ${id}`, assignment_id: "a1",
  assignment_title: "PR Pecahan", course_name: "Matematika", class_id: "c1", score, grade_letter: score >= 90 ? "A" : "C", feedback: "Cukup baik",
});

let submissions: AiSubmissionItem[];
let gradeReply: unknown;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  signInAs("t1");
  vi.stubGlobal("alert", vi.fn());
  vi.spyOn(console, "error").mockImplementation(() => {});
  submissions = [sub("x1"), sub("x2", { already_graded: true }), sub("x3", { file_name: null, is_late: true })];
  gradeReply = { success: true, data: { results: [result("x1", 75)], skipped: [] } };
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    Response.json(init?.method === "POST" ? gradeReply : { success: true, data: { submissions } }));
  vi.stubGlobal("fetch", fetchMock);
});

const open = () => {
  const props = { onClose: vi.fn(), onSaved: vi.fn(), onRejected: vi.fn() };
  return { props, rendered: renderWithProviders(<ScorpioGradingModal isOpen {...props} />, { role: "teacher" }) };
};
const checkbox = (name: string) => within(screen.getByText(name).closest("label")!).getByRole("checkbox");
const start = () => fireEvent.click(screen.getByRole("button", { name: /Mulai Penilaian/ }));

describe("ScorpioGradingModal: choosing work", () => {
  it("preselects ungraded work that has an answer file", async () => {
    await open().rendered;
    await screen.findByText("Siswa x1");

    expect(checkbox("Siswa x1")).toBeChecked();
    expect(checkbox("Siswa x2")).not.toBeChecked();
    expect(checkbox("Siswa x3")).toBeDisabled();
    expect(screen.getByText("Tidak ada file jawaban")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mulai Penilaian (1)" })).toBeEnabled();
  });

  it("allows at most 10 at once", async () => {
    submissions = Array.from({ length: 12 }, (_, i) => sub(`n${i}`));
    await open().rendered;
    await screen.findByText("Siswa n0");

    expect(screen.getAllByRole("checkbox").filter(c => (c as HTMLInputElement).checked)).toHaveLength(10);
    expect(checkbox("Siswa n11")).toBeDisabled();
    fireEvent.click(checkbox("Siswa n0"));
    expect(checkbox("Siswa n11")).toBeEnabled();
  });

  it("says when nothing has been submitted", async () => {
    submissions = [];
    await open().rendered;
    expect(await screen.findByText("Belum ada tugas yang dikumpulkan oleh siswa.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mulai Penilaian (0)" })).toBeDisabled();
  });
});

describe("ScorpioGradingModal: grading", () => {
  it("sends the chosen work to ScorpioAI as the logged-in teacher", async () => {
    await open().rendered;
    await screen.findByText("Siswa x1");
    fireEvent.click(checkbox("Siswa x2"));
    start();

    await screen.findByText("Pratinjau Hasil Penilaian");
    const [url, init] = fetchMock.mock.calls.find(c => c[1]?.method === "POST")!;
    expect(url).toBe("/api/ScorpioAI");
    expect(JSON.parse(init.body)).toEqual({ action: "grade", submissionIds: ["x1", "x2"] });
    expect(init.headers.Authorization).toBe("Bearer token-t1");
  });

  it("lets the teacher adjust the AI grade, then saves it", async () => {
    const { props, rendered } = open();
    await rendered;
    await screen.findByText("Siswa x1");
    start();
    await screen.findByText("Pratinjau Hasil Penilaian");

    expect(screen.getByText("Nilai C")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Nilai" }), { target: { value: "150" } });
    expect(screen.getByRole("spinbutton", { name: "Nilai" })).toHaveValue(100);
    expect(screen.getByText("Nilai A")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Feedback untuk siswa" }), { target: { value: "Sempurna!" } });
    fireEvent.click(screen.getByRole("button", { name: "Setuju & Simpan" }));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(1));
    expect(props.onClose).toHaveBeenCalled();
    expect(Object.values(getFirestoreData("grades"))).toEqual([
      expect.objectContaining({ student_id: "s-x1", assignment_id: "a1", score: 100, grade_letter: "A", feedback: "Sempurna!", credits: 1, graded_by: "t1" }),
    ]);
  });

  it("lists work the AI could not read", async () => {
    gradeReply = { success: true, data: { results: [], skipped: ["Siswa x1 · PR Pecahan"] } };
    await open().rendered;
    await screen.findByText("Siswa x1");
    start();
    expect(await screen.findByText("Siswa x1 · PR Pecahan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Setuju & Simpan" })).toBeDisabled();
  });

  it("hands the results back when the teacher rejects them", async () => {
    const { props, rendered } = open();
    await rendered;
    await screen.findByText("Siswa x1");
    start();
    fireEvent.click(await screen.findByRole("button", { name: "Kurang Bagus" }));

    expect(props.onRejected).toHaveBeenCalledWith([result("x1", 75)]);
    expect(getFirestoreData("grades")).toEqual({});
  });

  it("returns to the list with a message when grading fails", async () => {
    gradeReply = { success: false, error: "boom" };
    await open().rendered;
    await screen.findByText("Siswa x1");
    start();

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Terjadi kesalahan saat menilai. Silakan coba lagi."));
    expect(screen.getByText("Pilih Tugas untuk Dinilai")).toBeInTheDocument();
  });
});
