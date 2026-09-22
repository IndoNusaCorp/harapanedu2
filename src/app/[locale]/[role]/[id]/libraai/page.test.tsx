import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { stubLibraBackend, withVoice } from "@/test/libra";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import LibraAIPage from "./page";

const live = await vi.hoisted(async () => (await import("@/test/voice")).fakeLive());
vi.mock("@google/genai", () => live.module);

let backend: ReturnType<typeof stubLibraBackend>;
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  backend = stubLibraBackend();
  live.sessions.length = 0;
});

const open = (who: "s1" | "s2" | "t1") => {
  const opts = loginAs(who, "/libraai");
  return renderWithProviders(withVoice(<LibraAIPage />, `/${who === "t1" ? "pengajar" : "pelajar"}/${who}`), opts);
};
const posts = () => backend.fetchMock.mock.calls.filter(c => c[1]?.method === "POST" && c[0] === "/api/LibraAI").map(c => JSON.parse(String(c[1]?.body)));

describe("LibraAI page", () => {
  it("uses the kids chat for elementary students", async () => {
    await open("s1");
    expect(await screen.findByText("Halo! Aku robot LibraAI ✨")).toBeInTheDocument();
  });

  it("offers students learning suggestions and sends them to LibraAI", async () => {
    await open("s2");
    expect(await screen.findByRole("heading", { name: "Asisten LibraAI" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Tugas apa saja yang tenggatnya paling dekat?" }));

    expect(await screen.findByText("Halo, aku LibraAI!")).toBeInTheDocument();
    expect(posts()[0]).toMatchObject({ message: "Tugas apa saja yang tenggatnya paling dekat?", locale: "id" });
  });

  it("offers teachers teaching suggestions", async () => {
    await open("t1");
    expect(await screen.findByText("Asisten mengajar Anda: susun materi, buat soal, dan rangkum kelas.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Contoh: buatkan 5 soal pilihan ganda dari materi ini")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buatkan 5 soal latihan beserta kunci jawabannya" })).toBeInTheDocument();
  });

  it("starts and stops a voice chat from the mic button", async () => {
    await open("s2");
    fireEvent.click(await screen.findByTitle("Mulai voice chat"));

    expect(await screen.findByText("Mendengarkan...")).toBeInTheDocument();
    expect(live.sessions).toHaveLength(1);
    fireEvent.click(screen.getByTitle("Akhiri voice chat"));

    await waitFor(() => expect(screen.queryByText("Mendengarkan...")).toBeNull());
    expect(live.sessions[0].close).toHaveBeenCalled();
    expect(backend.audio.track.stop).toHaveBeenCalled();
  });
});
