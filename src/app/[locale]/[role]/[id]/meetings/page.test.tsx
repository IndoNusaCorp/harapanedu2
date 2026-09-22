import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc, seedFirestore } from "@/test/fakeFirebase";
import { installFakeMedia } from "@/test/meeting";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import MeetingsPage from "./page";

const peerjs = await vi.hoisted(async () => (await import("@/test/meeting")).fakePeerJs());
vi.mock("peerjs", () => peerjs.module);
vi.mock("@/lib/meeting/cameraEffects", async () => (await import("@/test/meeting")).fakeCameraEffects());

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  installFakeMedia();
});

const card = (title: string) => screen.getByRole("heading", { name: title }).closest("div.flex.flex-col") as HTMLElement;
const open = (who: "s1" | "s2" | "t1") => renderWithProviders(<MeetingsPage />, loginAs(who, "/meetings"));

describe("Meetings page", () => {
  it("uses the kids view for elementary students", async () => {
    await open("s1");
    expect(await screen.findByText("Ayo Gabung Kelas Online 👋")).toBeInTheDocument();
  });

  it("lists meetings and marks live ones with their participants", async () => {
    const who = loginAs("s2", "/meetings");
    seedFirestore({ meetings: { m2: { title: "Kelas Live", time: "Sekarang", status: "live", activeParticipants: ["t1", "s9"], created_at: "2026-09-20T00:00:00Z" } } });
    await renderWithProviders(<MeetingsPage />, who);

    expect(await screen.findByRole("heading", { name: "Kelas Live" })).toBeInTheDocument();
    expect(within(card("Kelas Live")).getByText("Berlangsung")).toBeInTheDocument();
    expect(within(card("Kelas Live")).getByText("2 Bergabung")).toBeInTheDocument();
    expect(within(card("Review Pecahan")).getByText("0 Bergabung")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jadwalkan Pertemuan" })).toBeNull();
  });

  it("lets a student join a live meeting", async () => {
    const who = loginAs("s2", "/meetings");
    seedFirestore({ meetings: { m2: { title: "Kelas Live", time: "", status: "live", host_id: "t1", created_at: "2026-09-20T00:00:00Z" } } });
    await renderWithProviders(<MeetingsPage />, who);
    const join = within(await waitFor(() => card("Kelas Live"))).getByRole("button", { name: "Gabung Pertemuan" });
    await waitFor(() => expect(join).toBeEnabled());
    fireEvent.click(join);

    expect(await screen.findByText("Budi Santoso (Anda)")).toBeInTheDocument();
    await waitFor(() => expect(getFirestoreDoc("meetings/m2")?.activeParticipants).toContain("s2"));
  });

  it("tells a student when a meeting has ended", async () => {
    const who = loginAs("s2", "/meetings");
    seedFirestore({ meetings: { m3: { title: "Sudah Selesai", time: "", status: "ended", isEnded: true, created_at: "2026-09-20T00:00:00Z" } } });
    await renderWithProviders(<MeetingsPage />, who);
    const join = within(await waitFor(() => card("Sudah Selesai"))).getByRole("button", { name: "Gabung Pertemuan" });
    await waitFor(() => expect(join).toBeEnabled());
    fireEvent.click(join);
    expect(screen.getByText("Pertemuan ini sudah diakhiri. Tunggu pengajar memulainya lagi.")).toBeInTheDocument();
  });

  it("lets teachers schedule, edit and delete meetings", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await open("t1");
    await screen.findByRole("heading", { name: "Review Pecahan" });

    fireEvent.click(screen.getByRole("button", { name: "Jadwalkan Pertemuan" }));
    fireEvent.change(screen.getByPlaceholderText("mis. Aljabar II - Review Mingguan"), { target: { value: "Remedial" } });
    fireEvent.change(screen.getByPlaceholderText("mis. Hari ini, 14.00"), { target: { value: "Jumat, 10.00" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Jadwalkan Pertemuan" }).at(-1)!);
    expect(await screen.findByRole("heading", { name: "Remedial" })).toBeInTheDocument(); // realtime list

    fireEvent.click(within(card("Review Pecahan")).getByRole("button", { name: "Ubah pertemuan" }));
    fireEvent.change(screen.getByPlaceholderText("mis. Hari ini, 14.00"), { target: { value: "Selasa, 09.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(getFirestoreDoc("meetings/m1")?.time).toBe("Selasa, 09.00"));

    fireEvent.click(within(card("Review Pecahan")).getByRole("button", { name: "Hapus pertemuan" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Review Pecahan" })).toBeNull());
    expect(Object.values(getFirestoreData("meetings")).map(m => m.title)).toEqual(["Remedial"]);
  });

  it("offers teachers to host", async () => {
    await open("t1");
    expect(await within(await waitFor(() => card("Review Pecahan"))).findByRole("button", { name: "Pimpin Pertemuan" })).toBeInTheDocument();
  });
});
