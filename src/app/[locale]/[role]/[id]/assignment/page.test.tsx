import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc } from "@/test/fakeFirebase";
import { router } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import AssignmentPage from "./page";

const card = (title: string) => screen.getByText(title).closest("a") as HTMLElement;

describe("Assignments page: student", () => {
  it("uses the kids view for elementary students", async () => {
    await renderWithProviders(<AssignmentPage />, loginAs("s1", "/assignment"));
    expect(await screen.findByText("Daftar tugas")).toBeInTheDocument();
  });

  it("shows the student's own status on each assignment", async () => {
    await renderWithProviders(<AssignmentPage />, loginAs("s2", "/assignment"));

    expect(await screen.findByText("PR Pecahan")).toBeInTheDocument();
    expect(within(card("PR Pecahan")).getByText("Dinilai")).toBeInTheDocument(); // Budi's is graded
    expect(within(card("PR Tumbuhan")).getByText("Aktif")).toBeInTheDocument();
    expect(within(card("PR Pecahan")).getByText("30 Sep")).toBeInTheDocument();
    expect(card("PR Pecahan")).toHaveAttribute("href", "/pelajar/s2/assignment/a1");
    expect(screen.queryByRole("button", { name: "Buat Tugas" })).toBeNull();
  });

  it("filters by status", async () => {
    await renderWithProviders(<AssignmentPage />, loginAs("s2", "/assignment"));
    await screen.findByText("PR Pecahan");

    fireEvent.click(screen.getByRole("button", { name: "Dinilai" }));
    expect(screen.getByRole("button", { name: "Dinilai" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("PR Tumbuhan")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Terlambat" }));
    expect(screen.getByText("Tugas tidak ditemukan")).toBeInTheDocument();
  });

  it("searches, starting from ?q and writing back to the URL", async () => {
    await renderWithProviders(<AssignmentPage />, loginAs("s2", "/assignment", "q=tumbuhan"));
    expect(await screen.findByText("PR Tumbuhan")).toBeInTheDocument();
    expect(screen.queryByText("PR Pecahan")).toBeNull();

    // The page has its own search box next to the filters (the top bar has one too)
    const pageSearch = screen.getAllByPlaceholderText("Cari tugas...").find(el => el.getAttribute("type") === "text")!;
    expect(pageSearch).toHaveValue("tumbuhan");
    fireEvent.change(pageSearch, { target: { value: "matematika" } });
    expect(router.replace).toHaveBeenLastCalledWith("/id/pelajar/s2/assignment?q=matematika");
    expect(screen.getByText("PR Pecahan")).toBeInTheDocument();
  });
});

describe("Assignments page: teacher", () => {
  it("creates an assignment for one of the teacher's classes", async () => {
    await renderWithProviders(<AssignmentPage />, loginAs("t1", "/assignment"));
    await screen.findByText("PR Pecahan");

    fireEvent.click(screen.getByRole("button", { name: "Buat Tugas" }));
    fireEvent.change(screen.getByPlaceholderText("mis. Esai Sejarah: Kerajaan Majapahit"), { target: { value: "Kuis Desimal" } });
    await screen.findByRole("option", { name: "Matematika 4A" });
    fireEvent.change(document.querySelector("select")!, { target: { value: "c1" } });
    fireEvent.change(document.querySelector('input[type="datetime-local"]')!, { target: { value: "2026-10-10T08:00" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Buat Tugas" }).at(-1)!);

    expect(await screen.findByText("Kuis Desimal")).toBeInTheDocument();
    expect(Object.values(getFirestoreData("assignments"))).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Kuis Desimal", course_name: "Matematika", class_id: "c1", teacher_id: "t1", status: "active" }),
    ]));
    // Students get notified
    expect(Object.values(getFirestoreData("notifications"))).toEqual([expect.objectContaining({ type: "assignment", title: "Kuis Desimal" })]);
  });

  it("deletes an assignment with its submissions and grades", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderWithProviders(<AssignmentPage />, loginAs("t1", "/assignment"));
    await screen.findByText("PR Pecahan");

    fireEvent.click(within(card("PR Pecahan")).getByRole("button", { name: "Hapus tugas" }));

    await waitFor(() => expect(screen.queryByText("PR Pecahan")).toBeNull());
    expect(getFirestoreDoc("assignments/a1")).toBeUndefined();
    expect(getFirestoreDoc("assignment_submissions/a1_s2")).toBeUndefined();
    expect(getFirestoreDoc("grades/g1")).toBeUndefined();
  });
});
