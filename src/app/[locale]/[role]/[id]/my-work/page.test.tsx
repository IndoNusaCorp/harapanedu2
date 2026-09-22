import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc, seedFirestore } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import MyWorkPage from "./page";

const card = (name: string) => screen.getByRole("heading", { name }).closest("div.flex.flex-col") as HTMLElement;
const tile = (cardEl: HTMLElement, label: string) => within(cardEl).getByText(label).parentElement!;

const openAsTeacher = (search = "") => {
  const who = loginAs("t1", "/my-work", search);
  seedFirestore({
    classes: { c1: { name: "Matematika 4A", course_name: "Matematika", description: "Pecahan dan desimal", teacher_id: "t1", created_at: "2026-09-01T00:00:00Z", attendance: 3, absence: 1, late: 2, excused_absence: 0 } },
    assignment_submissions: { a1_s9: { assignment_id: "a1", student_id: "s9", status: "submitted" } },
    attendances: {
      x1: { class_id: "c1", student_id: "s2", status: "Attended" },
      x2: { class_id: "c1", student_id: "s2", status: "Late" },
      x3: { class_id: "c1", student_id: "s9", status: "Absence" },
    },
  });
  return renderWithProviders(<MyWorkPage />, who);
};

describe("My work page (teacher)", () => {
  it("summarises each of the teacher's classes", async () => {
    await openAsTeacher();
    const c1 = await waitFor(() => card("Matematika 4A"));

    expect(screen.queryByRole("heading", { name: "IPA 8B" })).toBeNull();
    expect(within(c1).getByText("1 Siswa Hadir")).toBeInTheDocument(); // Budi, counted once
    expect(tile(c1, "Perlu Dinilai")).toHaveTextContent("1"); // s9's work; Budi's is graded
    expect(tile(c1, "Pesan / Feedback")).toHaveTextContent("1");
    expect(within(c1).getByText("Hadir: 3")).toBeInTheDocument();
    expect(within(c1).getByText("Terlambat: 2")).toBeInTheDocument();
  });

  it("creates a class", async () => {
    await openAsTeacher();
    await waitFor(() => card("Matematika 4A"));
    fireEvent.click(screen.getByRole("button", { name: "Buat Kelas" }));
    fireEvent.change(screen.getByPlaceholderText("mis. MTK - 201"), { target: { value: "IPS 4A" } });
    fireEvent.change(screen.getByPlaceholderText("mis. Aljabar II"), { target: { value: "IPS" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Buat Kelas" }).at(-1)!);

    const created = await waitFor(() => card("IPS 4A"));
    expect(tile(created, "Perlu Dinilai")).toHaveTextContent("0");
    expect(Object.values(getFirestoreData("classes"))).toEqual(expect.arrayContaining([expect.objectContaining({ name: "IPS 4A", teacher_id: "t1" })]));
  });

  it("creates an assignment for the class it was opened from", async () => {
    await openAsTeacher();
    const c1 = await waitFor(() => card("Matematika 4A"));
    fireEvent.click(within(c1).getByRole("button", { name: "Tugas" }));

    await waitFor(() => expect(document.querySelector("select")).toHaveValue("c1"));
    fireEvent.change(screen.getByPlaceholderText("mis. Esai Sejarah: Kerajaan Majapahit"), { target: { value: "Kuis Desimal" } });
    fireEvent.change(document.querySelector('input[type="datetime-local"]')!, { target: { value: "2026-10-10T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Buat Tugas" }));

    await waitFor(() => expect(Object.values(getFirestoreData("assignments"))).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Kuis Desimal", class_id: "c1", course_name: "Matematika" }),
    ])));
  });

  it("opens the student directory", async () => {
    await openAsTeacher();
    await waitFor(() => card("Matematika 4A"));
    fireEvent.click(screen.getByRole("button", { name: "Daftar Siswa" }));
    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Ani Putri")).toBeInTheDocument();
  });

  it("deletes a class after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openAsTeacher();
    const c1 = await waitFor(() => card("Matematika 4A"));
    fireEvent.click(within(c1).getByRole("button", { name: "Hapus kelas" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Matematika 4A" })).toBeNull());
    expect(getFirestoreDoc("classes/c1")).toBeUndefined();
    expect(screen.getByText("Belum ada kelas")).toBeInTheDocument();
  });

  it("filters classes with the top bar search", async () => {
    await openAsTeacher("q=kimia");
    expect(await screen.findByText("Belum ada kelas")).toBeInTheDocument();
  });
});
