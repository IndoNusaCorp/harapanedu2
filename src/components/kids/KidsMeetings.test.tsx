import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { seedFirestore, signInAs } from "@/test/fakeFirebase";
import { installFakeMedia } from "@/test/meeting";
import { setNavigation } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import KidsMeetings from "./KidsMeetings";

const peerjs = await vi.hoisted(async () => (await import("@/test/meeting")).fakePeerJs());
vi.mock("peerjs", () => peerjs.module);
vi.mock("@/lib/meeting/cameraEffects", async () => (await import("@/test/meeting")).fakeCameraEffects());

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  installFakeMedia();
  signInAs("s1");
  setNavigation({ params: { role: "pelajar", id: "s1" } });
});

const renderPage = () => renderWithProviders(<KidsMeetings />, { classLevel: 2 });

describe("KidsMeetings", () => {
  it("lists meetings and highlights the live one", async () => {
    seedFirestore({
      users: { s1: { first_name: "Ani" } },
      meetings: {
        m1: { title: "Belajar Huruf", time: "Senin 08.00", status: "upcoming", created_at: "2026-09-01" },
        m2: { title: "Kelas Pagi", time: "Sekarang", status: "live", activeParticipants: ["t1", "s2"], created_at: "2026-09-02" },
      },
    });
    await renderPage();

    expect(await screen.findByText("Kelas Pagi")).toBeInTheDocument();
    expect(screen.getByText("SEDANG BERLANGSUNG")).toBeInTheDocument();
    expect(screen.getByText("🧑‍🤝‍🧑 2 teman bergabung")).toBeInTheDocument();
    expect(screen.getByText("Belajar Huruf")).toBeInTheDocument();
    expect(screen.getByText("🧑‍🤝‍🧑 0 teman bergabung")).toBeInTheDocument();
  });

  it("says when there is nothing today", async () => {
    await renderPage();
    expect(await screen.findByText("Tidak ada kelas virtual hari ini")).toBeInTheDocument();
  });

  it("joins a live meeting in the kids room", async () => {
    seedFirestore({
      users: { s1: { first_name: "Ani" } },
      meetings: { m2: { title: "Kelas Pagi", time: "", status: "live", host_id: "t1", created_at: "2026-09-02" } },
    });
    await renderPage();
    const join = await screen.findByRole("button", { name: "Gabung Sekarang 🚀" });
    await waitFor(() => expect(join).toBeEnabled());
    fireEvent.click(join);

    expect(await screen.findByText("Ani (Aku)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kelas Pagi" })).toBeInTheDocument();
  });

  it("explains that an ended meeting can't be joined", async () => {
    seedFirestore({
      users: { s1: { first_name: "Ani" } },
      meetings: { m3: { title: "Sudah Selesai", time: "", status: "ended", isEnded: true, created_at: "2026-09-02" } },
    });
    await renderPage();
    const join = await screen.findByRole("button", { name: "Gabung Sekarang 🚀" });
    await waitFor(() => expect(join).toBeEnabled());
    fireEvent.click(join);

    const { default: id } = await import("@/components/translate/id");
    expect(screen.getByText(id.kids.meetingRoom.exit.notStarted)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(screen.queryByText(id.kids.meetingRoom.exit.notStarted)).toBeNull();
  });
});
