import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { seedFirestore } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { TODAY, loginAs } from "@/test/school";
import KidsDashboard from "./KidsDashboard";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});
afterEach(() => vi.useRealTimers());

const card = (label: string) => screen.getByText(label).parentElement!;

describe("KidsDashboard", () => {
  it("cheers the child on with their classes and waiting tasks", async () => {
    await renderWithProviders(<KidsDashboard />, loginAs("s1"));

    expect(await screen.findByText("Kamu punya 2 kelas aktif. Ayo mulai belajar!")).toBeInTheDocument();
    expect(screen.getByText("📅 Senin, 21 September 2026 · 2 tugas menunggu. Semangat! 💪")).toBeInTheDocument();
    expect(within(card("Ada Tugas")).getByText("2")).toBeInTheDocument();
    expect(within(card("Meeting")).getByText("1")).toBeInTheDocument();
  });

  it("celebrates the child's average once they have grades", async () => {
    const who = loginAs("s1");
    seedFirestore({ grades: { k1: { student_id: "s1", course_name: "Matematika", score: 92, credits: 2, created_at: "2026-09-18T00:00:00Z" } } });
    await renderWithProviders(<KidsDashboard />, who);
    expect(await screen.findByText("Wah, nilai rata-ratamu 4.00! Keren Banget! 🌟")).toBeInTheDocument();
  });

  it("lists recent tasks with the child's status and the next online class", async () => {
    await renderWithProviders(<KidsDashboard />, loginAs("s1"));
    const row = (await screen.findByText("PR Pecahan")).closest("a") as HTMLElement;
    expect(within(row).getByText("⏰ Sedang dikerjakan")).toBeInTheDocument();
    expect(row).toHaveAttribute("href", "/pelajar/s1/assignment/a1");
    expect(screen.getByText("Review Pecahan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Gabung Kelas Online/ })).toHaveAttribute("href", "/pelajar/s1/meetings");
  });

  it("shows empty states", async () => {
    const who = loginAs("s1");
    const { resetFirebase, signInAs } = await import("@/test/fakeFirebase");
    resetFirebase();
    signInAs("s1");
    await renderWithProviders(<KidsDashboard />, who);
    await waitFor(() => expect(screen.getByText("Belum ada tugas!")).toBeInTheDocument());
    expect(screen.getByText("Jadwalmu kosong!")).toBeInTheDocument();
  });
});
