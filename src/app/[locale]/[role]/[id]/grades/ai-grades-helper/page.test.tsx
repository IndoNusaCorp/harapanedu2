import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreData } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import type { AiGradeResult, AiSubmissionItem } from "@/lib/types";
import AIGradesHelperPage from "./page";

const submission: AiSubmissionItem = {
  submission_id: "a1_s2", student_id: "s2", student_name: "Budi Santoso", assignment_id: "a1", assignment_title: "PR Pecahan",
  course_name: "Matematika", class_id: "c1", file_name: "budi.pdf", submitted_at: "2026-09-16T00:00:00Z", is_late: false, already_graded: false,
};
const result: AiGradeResult = {
  submission_id: "a1_s2", student_id: "s2", student_name: "Budi Santoso", assignment_id: "a1", assignment_title: "PR Pecahan",
  course_name: "Matematika", class_id: "c1", score: 84, grade_letter: "B", feedback: "Langkah sudah benar.",
};

let chatReply: string;
beforeEach(() => {
  chatReply = "Siap membantu.";
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (body?.action === "grade") return Response.json({ success: true, data: { results: [result], skipped: [] } });
    if (body) return Response.json({ success: true, data: { text: chatReply } });
    return Response.json({ success: true, data: { role: "teacher", files: [], submissions: [submission] } });
  }));
});

const open = (who: "s1" | "s2" | "t1") => renderWithProviders(<AIGradesHelperPage />, loginAs(who, "/grades/ai-grades-helper"));
const ask = (text: string) => {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter" });
};

describe("ScorpioAI page", () => {
  it("uses the kids chat for elementary students", async () => {
    await open("s1");
    expect(await screen.findByRole("button", { name: "Lihat nilai-nilaiku ⭐" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Gimana caranya biar nilaiku bagus?")).toBeInTheDocument();
  });

  it("helps students improve without offering grading", async () => {
    await open("s2");
    expect(await screen.findByText("Teman untuk membantu Anda memperbaiki nilai.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tampilkan semua nilai saya" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bantu saya menilai tugas siswa" })).toBeNull();
  });

  it("never shows students the grade button, even if the AI sends the marker", async () => {
    chatReply = "Ini nilaimu [BANTU_NILAI]";
    await open("s2");
    await screen.findByRole("textbox");
    ask("Nilaiku?");
    expect(await screen.findByText("Ini nilaimu")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bantu saya menilai tugas siswa" })).toBeNull();
  });

  it("turns the AI's marker into a grade button for teachers", async () => {
    chatReply = "Ada 1 tugas yang belum dinilai. [BANTU_NILAI]";
    await open("t1");
    await screen.findByRole("textbox");
    ask("Tampilkan pengumpulan");

    expect(await screen.findByText("Ada 1 tugas yang belum dinilai.")).toBeInTheDocument();
    expect(screen.queryByText(/\[BANTU_NILAI\]/)).toBeNull();
    expect(screen.getAllByRole("button", { name: "Bantu saya menilai tugas siswa" })).toHaveLength(2); // message + input bar
  });

  it("saves approved AI grades and reports it in the chat", async () => {
    await open("t1");
    fireEvent.click(await screen.findByRole("button", { name: "Bantu saya menilai tugas siswa" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mulai Penilaian (1)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Setuju & Simpan" }));

    expect(await screen.findByText("Penilaian berhasil disimpan!")).toBeInTheDocument();
    expect(Object.values(getFirestoreData("grades"))).toEqual(expect.arrayContaining([
      expect.objectContaining({ student_id: "s2", assignment_id: "a1", score: 84, feedback: "Langkah sudah benar." }),
    ]));
    await waitFor(() => expect(Object.values(getFirestoreData("ai_chats"))[0]?.assistant).toBe("scorpio"));
  });

  it("lists rejected AI grades for manual grading", async () => {
    await open("t1");
    fireEvent.click(await screen.findByRole("button", { name: "Bantu saya menilai tugas siswa" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mulai Penilaian (1)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Kurang Bagus" }));

    expect(await screen.findByText("Penilaian dikembalikan ke Bapak/Ibu.")).toBeInTheDocument();
    expect(screen.getByText("Budi Santoso: PR Pecahan")).toBeInTheDocument();
  });
});
