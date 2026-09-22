import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { TODAY, loginAs } from "@/test/school";
import MyClassesPage from "./page";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});
afterEach(() => vi.useRealTimers());

const card = (name: string) => screen.getByRole("heading", { name }).closest("div.flex.flex-col") as HTMLElement;

describe("My classes page: student", () => {
  it("uses the kids view for elementary students", async () => {
    await renderWithProviders(<MyClassesPage />, loginAs("s1", "/my-classes"));
    expect(await screen.findByText("AYO MULAI BELAJAR!")).toBeInTheDocument();
  });

  it("lists every class with the student's progress", async () => {
    await renderWithProviders(<MyClassesPage />, loginAs("s2", "/my-classes"));

    expect(await screen.findByRole("heading", { name: "Kelas yang Anda Ikuti" })).toBeInTheDocument();
    await screen.findByRole("heading", { name: "Matematika 4A" });
    // Budi's PR Pecahan is graded (uploaded) but he never attended: 0% + 1/1 × 50%
    expect(within(card("Matematika 4A")).getByText("50%")).toBeInTheDocument();
    expect(within(card("IPA 8B")).getByText("Belum dijadwalkan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buat Kelas" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hapus kelas" })).toBeNull();
  });

  it("filters by the search in the URL", async () => {
    await renderWithProviders(<MyClassesPage />, loginAs("s2", "/my-classes", "q=desimal"));
    expect(await screen.findByRole("heading", { name: "Matematika 4A" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "IPA 8B" })).toBeNull();
  });

  it("shows an empty state when nothing matches", async () => {
    await renderWithProviders(<MyClassesPage />, loginAs("s2", "/my-classes", "q=sejarah"));
    expect(await screen.findByText("Kelas tidak ditemukan")).toBeInTheDocument();
  });
});

describe("My classes page: teacher", () => {
  it("shows only the teacher's own classes", async () => {
    await renderWithProviders(<MyClassesPage />, loginAs("t1", "/my-classes"));
    expect(await screen.findByRole("heading", { name: "Matematika 4A" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "IPA 8B" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Kelola Kelas" })).toBeInTheDocument();
  });

  it("creates a class", async () => {
    await renderWithProviders(<MyClassesPage />, loginAs("t1", "/my-classes"));
    await screen.findByRole("heading", { name: "Matematika 4A" });

    fireEvent.click(screen.getByRole("button", { name: "Buat Kelas" }));
    fireEvent.change(screen.getByPlaceholderText("mis. MTK - 201"), { target: { value: "Bahasa 4A" } });
    fireEvent.change(screen.getByPlaceholderText("mis. Aljabar II"), { target: { value: "Bahasa Indonesia" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Buat Kelas" }).at(-1)!);

    expect(await screen.findByRole("heading", { name: "Bahasa 4A" })).toBeInTheDocument();
    expect(Object.values(getFirestoreData("classes"))).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Bahasa 4A", course_name: "Bahasa Indonesia", teacher_id: "t1" }),
    ]));
  });

  it("edits a class", async () => {
    await renderWithProviders(<MyClassesPage />, loginAs("t1", "/my-classes"));
    await screen.findByRole("heading", { name: "Matematika 4A" });

    fireEvent.click(within(card("Matematika 4A")).getByRole("button", { name: "Ubah kelas" }));
    fireEvent.change(screen.getByPlaceholderText("mis. MTK - 201"), { target: { value: "Matematika 4A (Pagi)" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    expect(await screen.findByRole("heading", { name: "Matematika 4A (Pagi)" })).toBeInTheDocument();
    expect(getFirestoreDoc("classes/c1")).toMatchObject({ name: "Matematika 4A (Pagi)", teacher_id: "t1" });
  });

  it("deletes a class with its assignments after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderWithProviders(<MyClassesPage />, loginAs("t1", "/my-classes"));
    await screen.findByRole("heading", { name: "Matematika 4A" });

    fireEvent.click(within(card("Matematika 4A")).getByRole("button", { name: "Hapus kelas" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Matematika 4A" })).toBeNull());
    expect(getFirestoreDoc("classes/c1")).toBeUndefined();
    expect(getFirestoreDoc("assignments/a1")).toBeUndefined();
    expect(getFirestoreDoc("classes/c2")).toBeDefined();
  });

  it("keeps the class when deletion is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderWithProviders(<MyClassesPage />, loginAs("t1", "/my-classes"));
    await screen.findByRole("heading", { name: "Matematika 4A" });
    fireEvent.click(within(card("Matematika 4A")).getByRole("button", { name: "Hapus kelas" }));
    expect(getFirestoreDoc("classes/c1")).toBeDefined();
  });
});
