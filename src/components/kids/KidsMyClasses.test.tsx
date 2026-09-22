import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreData, seedFirestore } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { TODAY, loginAs } from "@/test/school";
import KidsMyClasses from "./KidsMyClasses";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});
afterEach(() => vi.useRealTimers());

const card = (name: string) => screen.getByRole("heading", { name }).closest("div.flex.flex-col") as HTMLElement;

describe("KidsMyClasses", () => {
  it("shows each class with the student's own progress", async () => {
    seedFirestore({ attendances: { x: { class_id: "c1", student_id: "s1", status: "Attended", created_at: TODAY.toISOString() } } });
    await renderWithProviders(<KidsMyClasses />, loginAs("s1"));

    expect(await screen.findByRole("heading", { name: "Matematika 4A" })).toBeInTheDocument();
    expect(within(card("Matematika 4A")).getByText("50%")).toBeInTheDocument(); // present, PR only started
    expect(within(card("IPA 8B")).getByText("0%")).toBeInTheDocument();
    expect(within(card("IPA 8B")).getByText("Belum ada jadwal")).toBeInTheDocument();
    expect(within(card("IPA 8B")).getByText("📘 Belum ada materi")).toBeInTheDocument();
  });

  it("locks attendance once the student has taken it today", async () => {
    seedFirestore({ attendances: { x: { class_id: "c1", student_id: "s1", status: "Late", created_at: TODAY.toISOString() } } });
    await renderWithProviders(<KidsMyClasses />, loginAs("s1"));
    await screen.findByRole("heading", { name: "Matematika 4A" });

    expect(within(card("Matematika 4A")).getByRole("button", { name: /Hadir/ })).toBeDisabled();
    expect(within(card("IPA 8B")).getByRole("button", { name: /Hadir/ })).toBeEnabled();
  });

  it("takes attendance for a class and then locks it", async () => {
    await renderWithProviders(<KidsMyClasses />, loginAs("s1"));
    await screen.findByRole("heading", { name: "Matematika 4A" });

    fireEvent.click(within(card("Matematika 4A")).getByRole("button", { name: /Hadir/ }));
    fireEvent.change(screen.getByPlaceholderText("Santoso"), { target: { value: "Putri" } });
    fireEvent.change(screen.getByPlaceholderText("Budi"), { target: { value: "Ani" } });
    fireEvent.click(screen.getByRole("button", { name: "Kirim Kehadiran" }));

    expect(await screen.findByText("Kehadiran Tercatat!")).toBeInTheDocument();
    expect(Object.values(getFirestoreData("attendances"))).toEqual([expect.objectContaining({ class_id: "c1", student_id: "s1" })]);
    await waitFor(() => expect(within(card("Matematika 4A")).getByRole("button", { name: /Hadir/ })).toBeDisabled());
  });

  it("opens the class material", async () => {
    // The viewer itself is covered by ViewMateriModal's tests; here the download just fails fast
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await renderWithProviders(<KidsMyClasses />, loginAs("s1"));
    fireEvent.click(await screen.findByRole("button", { name: /bab1\.pdf/ }));
    expect(screen.getByRole("dialog", { name: "bab1.pdf" })).toBeInTheDocument();
    expect(await screen.findByText("Dokumen Gagal Dimuat")).toBeInTheDocument();
  });

  it("tells the child when there are no classes yet", async () => {
    const who = loginAs("s1");
    const { resetFirebase, signInAs } = await import("@/test/fakeFirebase");
    resetFirebase();
    signInAs("s1");
    await renderWithProviders(<KidsMyClasses />, who);
    expect(await screen.findByText("Belum ada kelas nih!")).toBeInTheDocument();
  });
});
