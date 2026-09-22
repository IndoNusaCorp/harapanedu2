import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { TODAY, loginAs } from "@/test/school";
import Dashboard from "./page";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});
afterEach(() => vi.useRealTimers());

const stat = (label: string) => screen.getByText(label).parentElement!;
const task = (title: string) => screen.getByText(title).closest("a") as HTMLElement;

describe("Dashboard: student", () => {
  it("uses the kids dashboard for elementary students", async () => {
    await renderWithProviders(<Dashboard />, loginAs("s1"));
    expect(await screen.findByText("HarapanEdu Kids", { exact: false })).toBeInTheDocument();
  });

  it("welcomes the student and summarises their work", async () => {
    await renderWithProviders(<Dashboard />, loginAs("s2"));

    expect(await screen.findByText("Selamat datang kembali, Budi Santoso (Pelajar)")).toBeInTheDocument();
    // PR Pecahan is graded, PR Tumbuhan still open
    await waitFor(() => expect(screen.getByText("Siap belajar? Anda memiliki 1 tugas yang belum selesai.")).toBeInTheDocument());
    expect(screen.getByText("IPK kumulatif Anda 3.70. Kemajuan yang luar biasa!")).toBeInTheDocument();
    expect(within(stat("IPK Kumulatif")).getByText("3.70")).toBeInTheDocument();
    expect(within(stat("Kelas Aktif")).getByText("2")).toBeInTheDocument();
  });

  it("lists recent assignments with the student's own status", async () => {
    await renderWithProviders(<Dashboard />, loginAs("s2"));
    await screen.findByText("PR Pecahan");
    expect(within(task("PR Pecahan")).getByText("Dinilai")).toBeInTheDocument();
    expect(task("PR Pecahan")).toHaveAttribute("href", "/pelajar/s2/assignment/a1");
    expect(within(task("PR Tumbuhan")).getByText("Aktif")).toBeInTheDocument();
  });

  it("shows the next meeting", async () => {
    await renderWithProviders(<Dashboard />, loginAs("s2"));
    expect(await screen.findByRole("heading", { name: "Review Pecahan" })).toBeInTheDocument();
    expect(screen.getByText("Mendatang")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Gabung Kelas Virtual/ })).toHaveAttribute("href", "/pelajar/s2/meetings");
  });
});

describe("Dashboard: teacher", () => {
  it("welcomes the teacher and shows the average of the grades they gave", async () => {
    await renderWithProviders(<Dashboard />, loginAs("t1"));

    expect(await screen.findByText("Selamat datang kembali, Sari Dewi (Pengajar)")).toBeInTheDocument();
    await waitFor(() => expect(within(stat("Nilai Rata-rata")).getByText("88%")).toBeInTheDocument());
    expect(screen.getByText("Dari 1 nilai yang Anda berikan")).toBeInTheDocument();
    expect(within(stat("Kelas Aktif")).getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Kelola Pertemuan/ })).toBeInTheDocument();
  });

  it("says when no grades have been given", async () => {
    const who = loginAs("t1");
    const { deleteGrade } = await import("@/lib/api");
    await deleteGrade("g1");
    await renderWithProviders(<Dashboard />, who);
    await waitFor(() => expect(screen.getByText("Belum ada nilai yang diberikan")).toBeInTheDocument());
    expect(within(stat("Nilai Rata-rata")).getByText("—")).toBeInTheDocument();
  });

  // KNOWN BUG: the teacher's summary counts every teacher's assignments ("telah memberikan 2 tugas"),
  // although Sari only gave PR Pecahan; PR Tumbuhan belongs to another teacher.
  it.fails("counts only the teacher's own assignments", async () => {
    await renderWithProviders(<Dashboard />, loginAs("t1"));
    expect(await screen.findByText("Saat ini Anda mengajar 1 kelas dan telah memberikan 1 tugas kepada siswa.")).toBeInTheDocument();
  });

  it("links to analytics and LibraAI", async () => {
    await renderWithProviders(<Dashboard />, loginAs("t1"));
    expect(await screen.findByRole("link", { name: "Lihat Analisis Detail" })).toHaveAttribute("href", "/pengajar/t1/grades");
    expect(screen.getByRole("link", { name: "Tanya LibraAI" })).toHaveAttribute("href", "/pengajar/t1/libraai");
  });
});
