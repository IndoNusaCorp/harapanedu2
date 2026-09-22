import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { TODAY, loginAs } from "@/test/school";
import KidsCalendar from "./KidsCalendar";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});
afterEach(() => vi.useRealTimers());

const day = (n: number) => screen.getAllByRole("button").find(b => b.getAttribute("aria-pressed") !== null && b.firstElementChild?.textContent === String(n))!;

describe("KidsCalendar", () => {
  it("shows a relaxed message on a free day", async () => {
    await renderWithProviders(<KidsCalendar />, loginAs("s1", "/calendar"));
    expect(await screen.findByText("Tidak ada jadwal")).toBeInTheDocument();
    expect(screen.getByText("hari ini")).toBeInTheDocument();
    expect(day(21)).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the activities of a chosen day", async () => {
    await renderWithProviders(<KidsCalendar />, loginAs("s1", "/calendar"));
    await screen.findByText("Tidak ada jadwal");

    expect(day(24)).toHaveTextContent("Ujian Tengah Semester");
    fireEvent.click(day(24));
    expect(within(screen.getByText("Agenda").parentElement!).getByText("Ujian Tengah Semester")).toBeInTheDocument();
    expect(screen.getByText("di tanggal ini")).toBeInTheDocument();
  });

  it("changes month", async () => {
    await renderWithProviders(<KidsCalendar />, loginAs("s1", "/calendar"));
    await screen.findByText("Tidak ada jadwal");
    fireEvent.click(screen.getByRole("button", { name: "Bulan berikutnya" }));
    expect(screen.getByText("Oktober 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hari Ini" }));
    expect(screen.getByText("September 2026")).toBeInTheDocument();
  });
});
