import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import type { VoicePanel } from "@/lib/ai/voiceTools";
import VoiceOverlay from "./VoiceOverlay";

type Props = React.ComponentProps<typeof VoiceOverlay>;
const show = (props: Partial<Props> = {}, variant: "default" | "kids" = "default") =>
  renderWithProviders(<VoiceOverlay status="listening" error={null} onStop={vi.fn()} variant={variant} {...props} />);

describe("VoiceOverlay", () => {
  it("is hidden while idle", async () => {
    const { container } = await show({ status: "idle" });
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["connecting", "Menghubungkan...", "Menyiapkan koneksi suara..."],
    ["listening", "Mendengarkan...", "Mulai berbicara, LibraAI mendengarkan Anda"],
    ["ai-speaking", "LibraAI berbicara...", "Mendengarkan respons dari LibraAI"],
  ] as const)("shows the %s state", async (status, label, hint) => {
    await show({ status });
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(hint)).toBeInTheDocument();
  });

  it("uses the playful wording in kids mode", async () => {
    await show({}, "kids");
    expect(screen.getByText("Aku mendengarkan... 👂")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Berhenti Ngobrol/ })).toBeInTheDocument();
  });

  it("shows the live transcript of both sides", async () => {
    await show({ userTranscript: " Apa itu pecahan? ", aiTranscript: "Pecahan adalah bagian." });
    expect(screen.getByText("Anda:").parentElement).toHaveTextContent("Anda: Apa itu pecahan?");
    expect(screen.getByText("LibraAI:").parentElement).toHaveTextContent("LibraAI: Pecahan adalah bagian.");
  });

  it("confirms the wake phrase and reminds how to use it", async () => {
    const { rerender } = await show();
    expect(screen.getByText('Ucapkan "Hey Libra" kapan saja untuk memanggil LibraAI')).toBeInTheDocument();
    rerender(<VoiceOverlay status="listening" error={null} onStop={vi.fn()} wakeDetected />);
    expect(screen.getByText("LibraAI siap mendengarkan!")).toBeInTheDocument();
  });

  it("toggles the mic and ends the conversation", async () => {
    const onToggleMute = vi.fn();
    const onStop = vi.fn();
    const { rerender } = await show({ onToggleMute, onStop });

    fireEvent.click(screen.getByTitle("Matikan mikrofon"));
    fireEvent.click(screen.getByRole("button", { name: /Akhiri Percakapan/ }));
    expect(onToggleMute).toHaveBeenCalled();
    expect(onStop).toHaveBeenCalled();

    rerender(<VoiceOverlay status="listening" error={null} onStop={onStop} onToggleMute={onToggleMute} isMuted />);
    expect(screen.getByTitle("Nyalakan mikrofon")).toHaveTextContent("Mic Mati");
    expect(screen.queryByText(/Hey Libra/)).toBeNull();
  });

  it("shows errors and closes from the backdrop", async () => {
    const onStop = vi.fn();
    const { container } = await show({ status: "error", error: "Akses mikrofon ditolak.", onStop, onToggleMute: vi.fn(), userTranscript: "halo" });

    expect(screen.getByText("Akses mikrofon ditolak.")).toBeInTheDocument();
    expect(screen.queryByTitle("Matikan mikrofon")).toBeNull();
    expect(screen.queryByText("halo")).toBeNull();
    fireEvent.click(container.querySelector(".backdrop-blur-xl")!);
    fireEvent.click(screen.getByRole("button", { name: /Tutup/ }));
    expect(onStop).toHaveBeenCalledTimes(2);
  });

  it("shows documents requested by voice and opens one", async () => {
    const panel: VoicePanel = {
      type: "documents", query: "pecahan", openId: null,
      items: [{ id: "class_materi:c1", name: "bab1.pdf", label: "Matematika 4A", kind: "class_materi", url: "https://x/1" }],
    };
    const onOpenFile = vi.fn();
    const onClosePanel = vi.fn();
    await show({ panel, onOpenFile, onClosePanel });

    expect(screen.getByText("Dokumen")).toBeInTheDocument();
    expect(screen.getByText("Hasil untuk “pecahan”", { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /bab1\.pdf/ }));
    expect(onOpenFile).toHaveBeenCalledWith("class_materi:c1");
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onClosePanel).toHaveBeenCalled();
  });
});
