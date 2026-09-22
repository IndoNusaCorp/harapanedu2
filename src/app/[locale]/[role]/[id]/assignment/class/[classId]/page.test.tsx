import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc, seedFirestore } from "@/test/fakeFirebase";
import { router, setNavigation } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { TODAY, loginAs } from "@/test/school";
import AssignmentManagementPage from "./page";

const open = (who: "s2" | "t1", classId = "c1", search = "") => {
  const opts = loginAs(who, `/assignment/class/${classId}`, search);
  setNavigation({ params: { role: who === "t1" ? "pengajar" : "pelajar", id: who, classId } });
  seedFirestore({ assignments: { a3: { title: "Kuis Desimal", course_name: "Matematika", class_id: "c1", teacher_id: "t1", status: "active", due_date: "2026-10-02T10:00:00.000Z" } } });
  return renderWithProviders(<AssignmentManagementPage />, opts);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});
afterEach(() => vi.useRealTimers());

describe("Class assignments page", () => {
  it("lists only this class's assignments, soonest due first", async () => {
    await open("s2");
    await screen.findByRole("heading", { name: "PR Pecahan" });
    expect(screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent).slice(0, 2)).toEqual(["PR Pecahan", "Kuis Desimal"]);
    expect(screen.queryByRole("heading", { name: "PR Tumbuhan" })).toBeNull();
    expect(screen.getAllByText("Tenggat: 30 Sep 2026")).toHaveLength(1);
  });

  it("searches and keeps the query in the URL", async () => {
    await open("s2", "c1", "q=kuis");
    expect(await screen.findByRole("heading", { name: "Kuis Desimal" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "PR Pecahan" })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Cari tugas"), { target: { value: "" } });
    expect(router.replace).toHaveBeenLastCalledWith("/id/pelajar/s2/assignment/class/c1?");
    expect(screen.getByRole("heading", { name: "PR Pecahan" })).toBeInTheDocument();
  });

  it("lets teachers add an assignment to this class", async () => {
    await open("t1");
    await screen.findByRole("heading", { name: "PR Pecahan" });
    expect(screen.queryByRole("button", { name: /Kumpulkan/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Buat Tugas Baru" }));
    fireEvent.change(screen.getByPlaceholderText("mis. Esai Sejarah: Kerajaan Majapahit"), { target: { value: "Latihan Pecahan" } });
    fireEvent.change(screen.getByPlaceholderText("mis. Sejarah Indonesia"), { target: { value: "Matematika" } });
    fireEvent.change(document.querySelector('input[type="datetime-local"]')!, { target: { value: "2026-10-08T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Buat Tugas" }));

    expect(await screen.findByRole("heading", { name: "Latihan Pecahan" })).toBeInTheDocument();
    expect(Object.values(getFirestoreData("assignments"))).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Latihan Pecahan", class_id: "c1", teacher_id: "t1" }),
    ]));
  });

  it("shows an empty state for a class without assignments", async () => {
    await open("s2", "c-empty");
    expect(await screen.findByText("Semua beres! Tidak ada tugas yang harus dikerjakan.")).toBeInTheDocument();
  });

  // KNOWN BUG: "Kumpulkan" calls updateAssignmentStatus, which marks the shared assignment as submitted for
  // every student and records no submission for the student who clicked. (This page isn't linked anywhere.)
  it.fails("records a student's submission without changing the assignment for everyone", async () => {
    await open("s2");
    await screen.findByRole("heading", { name: "Kuis Desimal" });
    fireEvent.click(screen.getAllByRole("button", { name: /Kumpulkan/ })[0]);

    await waitFor(() => expect(getFirestoreDoc("assignment_submissions/a3_s2")).toMatchObject({ status: "submitted" }));
    expect(getFirestoreDoc("assignments/a3")?.status).toBe("active");
  });
});
