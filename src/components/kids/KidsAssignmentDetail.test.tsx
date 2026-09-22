import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreDoc } from "@/test/fakeFirebase";
import { router, setNavigation } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { TODAY, loginAs } from "@/test/school";
import KidsAssignmentDetail from "./KidsAssignmentDetail";

const open = (assignmentId: string) => {
  const opts = loginAs("s1", `/assignment/${assignmentId}`);
  setNavigation({ params: { role: "pelajar", id: "s1", assignmentId } });
  return renderWithProviders(<KidsAssignmentDetail />, opts);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  vi.stubGlobal("alert", vi.fn());
});
afterEach(() => vi.useRealTimers());

describe("KidsAssignmentDetail", () => {
  it("shows the task in kid-friendly wording", async () => {
    await open("a1");
    expect(await screen.findByRole("heading", { name: "PR Pecahan" })).toBeInTheDocument();
    expect(screen.getByText("Kerjakan soal 1-10")).toBeInTheDocument();
    expect(screen.getByText(/Dikumpulkan paling lambat:/)).toBeInTheDocument();
  });

  it("lets the child send their answer", async () => {
    await open("a1");
    await screen.findByRole("heading", { name: "PR Pecahan" });
    const send = screen.getByRole("button", { name: "Kirim Tugas Sekarang! 🚀" });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Pilih File"), { target: { files: [new File(["x"], "foto-tugas.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(send);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Yeay! Tugasmu berhasil dikirim! 🎉"));
    expect(getFirestoreDoc("assignment_submissions/a1_s1")).toMatchObject({ status: "submitted", file_name: "foto-tugas.jpg" });
    expect(await screen.findByText("Tugas Sudah Dikirim! Hebat!")).toBeInTheDocument();
  });

  it("goes back to the list", async () => {
    await open("a1");
    fireEvent.click(await screen.findByRole("button", { name: /Kembali ke Daftar Tugas/ }));
    expect(router.back).toHaveBeenCalled();
  });

  it("says when the task can't be found", async () => {
    await open("gone");
    expect(await screen.findByText("Tugas Tidak Ditemukan")).toBeInTheDocument();
  });
});
