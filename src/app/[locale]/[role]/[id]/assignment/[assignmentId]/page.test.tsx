import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc } from "@/test/fakeFirebase";
import { router, setNavigation } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { TODAY, loginAs } from "@/test/school";
import AssignmentDetailPage from "./page";

const open = (who: "s1" | "s2" | "t1", assignmentId: string) => {
  const opts = loginAs(who, `/assignment/${assignmentId}`);
  setNavigation({ params: { role: who === "t1" ? "pengajar" : "pelajar", id: who, assignmentId } });
  return renderWithProviders(<AssignmentDetailPage />, opts);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  vi.stubGlobal("alert", vi.fn());
});
afterEach(() => vi.useRealTimers());

describe("Assignment detail: student", () => {
  it("uses the kids view for elementary students", async () => {
    await open("s1", "a1");
    expect(await screen.findByText("Kumpulkan Tugasmu")).toBeInTheDocument();
  });

  it("shows the assignment and marks it as started", async () => {
    await open("s2", "a2");

    expect(await screen.findByRole("heading", { name: "PR Tumbuhan" })).toBeInTheDocument();
    expect(screen.getByText("Tidak ada deskripsi.")).toBeInTheDocument();
    expect(screen.getByText("Tidak ada dokumen soal.")).toBeInTheDocument();
    expect(screen.queryByText("Terlambat")).toBeNull();
    await waitFor(() => expect(getFirestoreDoc("assignment_submissions/a2_s2")).toMatchObject({ status: "started", student_id: "s2" }));
  });

  it("uploads and submits an answer", async () => {
    await open("s2", "a2");
    await screen.findByRole("heading", { name: "PR Tumbuhan" });
    expect(screen.getByRole("button", { name: "Kumpulkan Tugas" })).toBeDisabled();

    const file = new File(["jawaban"], "jawaban-budi.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Pilih File"), { target: { files: [file] } });
    expect(screen.getByText("Dipilih: jawaban-budi.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kumpulkan Tugas" }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Tugas berhasil dikumpulkan!"));
    expect(getFirestoreDoc("assignment_submissions/a2_s2")).toMatchObject({
      status: "submitted", file_name: "jawaban-budi.pdf", file_url: expect.stringContaining("jawaban-budi.pdf"),
    });
    expect(await screen.findByText("Sudah Dikumpulkan")).toBeInTheDocument();
  });

  it("shows work that was already handed in instead of the upload form", async () => {
    await open("s2", "a1");
    expect(await screen.findByText("Sudah Dikumpulkan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lihat Jawaban" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kumpulkan Tugas" })).toBeNull();
    // Opening it again must not reset the graded work to "started"
    await waitFor(() => expect(getFirestoreDoc("assignment_submissions/a1_s2")?.status).toBe("graded"));
  });

  it("flags an assignment past its deadline", async () => {
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    await open("s2", "a1");
    expect(await screen.findByText("Terlambat")).toBeInTheDocument();
  });

  it("handles an assignment that no longer exists", async () => {
    await open("s2", "missing");
    expect(await screen.findByText("Tugas Tidak Ditemukan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kembali" }));
    expect(router.back).toHaveBeenCalled();
  });
});

describe("Assignment detail: teacher", () => {
  it("lists handed-in work but not work that was only started", async () => {
    await open("t1", "a1");
    expect(await screen.findByText("Pengumpulan Siswa (1)")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Budi Santoso")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Dinilai")).toBeInTheDocument();
    expect(screen.queryByText("Ani Putri")).toBeNull();
    // Teachers don't start assignments
    expect(getFirestoreData("assignment_submissions")).not.toHaveProperty("a1_t1");
  });

  it("grades a submission", async () => {
    await open("t1", "a1");
    await screen.findByText("Budi Santoso");

    fireEvent.click(screen.getByRole("button", { name: "Nilai" }));
    fireEvent.change(screen.getByPlaceholderText("95"), { target: { value: "92" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Nilai" }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Nilai berhasil disimpan!"));
    expect(Object.values(getFirestoreData("grades"))).toEqual(expect.arrayContaining([
      expect.objectContaining({ student_id: "s2", assignment_id: "a1", class_id: "c1", course_name: "Matematika", score: 92, graded_by: "t1" }),
    ]));
  });

  it("opens a student's answer", async () => {
    // The viewer itself is covered by ViewMateriModal's tests; here the download just fails fast
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await open("t1", "a1");
    await screen.findByText("Budi Santoso");
    fireEvent.click(screen.getByRole("button", { name: "Lihat" }));
    expect(screen.getByRole("dialog", { name: "Jawaban Budi Santoso" })).toBeInTheDocument();
    expect(await screen.findByText("Dokumen Gagal Dimuat")).toBeInTheDocument();
  });
});
