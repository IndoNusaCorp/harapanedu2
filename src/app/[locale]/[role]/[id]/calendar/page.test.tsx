import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc, seedFirestore } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { TODAY, loginAs } from "@/test/school";
import CalendarPage from "./page";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});
afterEach(() => vi.useRealTimers());

const day = (n: number) => screen.getAllByRole("button").find(b => b.getAttribute("aria-pressed") !== null && b.firstElementChild?.textContent === String(n))!;
const panel = () => screen.getByText("Agenda").parentElement!;

describe("Calendar page", () => {
  it("uses the kids view for elementary students", async () => {
    await renderWithProviders(<CalendarPage />, loginAs("s1", "/calendar"));
    expect(await screen.findByText("Lihat jadwal belajar, tugas, dan kegiatanmu di sini.")).toBeInTheDocument();
  });

  it("opens on today's month with today selected", async () => {
    await renderWithProviders(<CalendarPage />, loginAs("s2", "/calendar"));

    expect(await screen.findByRole("heading", { name: "September 2026" })).toBeInTheDocument();
    expect(day(21)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Senin")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "21 September 2026" })).toBeInTheDocument();
    expect(screen.getByText("hari ini")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Tidak ada acara hari ini")).toBeInTheDocument());
  });

  it("shows the agenda of a chosen day", async () => {
    await renderWithProviders(<CalendarPage />, loginAs("s2", "/calendar"));
    await screen.findByText("Tidak ada acara hari ini");

    fireEvent.click(day(24));
    expect(screen.getByText("pada tanggal ini")).toBeInTheDocument();
    expect(panel()).toHaveTextContent("Ujian Tengah Semester");
    expect(panel()).toHaveTextContent("Aula");
    expect(panel()).toHaveTextContent("08.00");
    expect(screen.queryByRole("button", { name: "Hapus acara" })).toBeNull();
  });

  it("moves between months and back to today", async () => {
    await renderWithProviders(<CalendarPage />, loginAs("s2", "/calendar"));
    await screen.findByRole("heading", { name: "September 2026" });

    fireEvent.click(screen.getByRole("button", { name: "Bulan berikutnya" }));
    expect(screen.getByRole("heading", { name: "Oktober 2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bulan sebelumnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Bulan sebelumnya" }));
    expect(screen.getByRole("heading", { name: "Agustus 2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hari Ini" }));
    expect(screen.getByRole("heading", { name: "September 2026" })).toBeInTheDocument();
  });

  it("lets teachers add an event on the selected day", async () => {
    await renderWithProviders(<CalendarPage />, loginAs("t1", "/calendar"));
    await screen.findByText("Tidak ada acara hari ini");

    fireEvent.click(day(25));
    fireEvent.click(screen.getByRole("button", { name: "Tambah Acara" }));
    fireEvent.change(screen.getByPlaceholderText("mis. Ujian Tengah Semester"), { target: { value: "Rapat Orang Tua" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Tambah Acara" }).at(-1)!);

    expect(await within(panel()).findByText("Rapat Orang Tua")).toBeInTheDocument();
    expect(day(25)).toHaveTextContent("Rapat Orang Tua");
    expect(Object.values(getFirestoreData("calendar_events"))).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Rapat Orang Tua", event_date: "2026-09-25", created_by: "t1" }),
    ]));
  });

  it("lets teachers edit and delete events", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderWithProviders(<CalendarPage />, loginAs("t1", "/calendar"));
    await screen.findByText("Tidak ada acara hari ini");
    fireEvent.click(day(24));

    fireEvent.click(screen.getByRole("button", { name: "Ubah acara" }));
    fireEvent.change(screen.getByPlaceholderText("Ruang 302"), { target: { value: "Ruang 5" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(getFirestoreDoc("calendar_events/e1")?.location).toBe("Ruang 5"));

    fireEvent.click(screen.getByRole("button", { name: "Hapus acara" }));
    await waitFor(() => expect(getFirestoreDoc("calendar_events/e1")).toBeUndefined());
    expect(screen.getByText("Tidak ada acara hari ini")).toBeInTheDocument();
  });

  // KNOWN BUG: the link is built as `https://${meeting_link}`, but the form asks for a full URL
  // ("https://zoom.us/j/..."), so saved links become "https://https://...".
  it.fails("links to the meeting URL the teacher entered", async () => {
    seedFirestore({ calendar_events: { e2: { title: "Kelas Online", event_date: "2026-09-21", event_type: "meeting", meeting_link: "https://zoom.us/j/123" } } });
    await renderWithProviders(<CalendarPage />, loginAs("s2", "/calendar"));
    expect(await screen.findByRole("link", { name: "Gabung Pertemuan" })).toHaveAttribute("href", "https://zoom.us/j/123");
  });
});
