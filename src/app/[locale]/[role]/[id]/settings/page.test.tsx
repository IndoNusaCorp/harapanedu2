import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/components/layout";
import { withVoice } from "@/test/libra";
import { router } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import SettingsPage from "./page";

const live = await vi.hoisted(async () => (await import("@/test/voice")).fakeLive());
vi.mock("@google/genai", () => live.module);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
});

const open = (who: "s1" | "s2" = "s2") => renderWithProviders(
  <ThemeProvider attribute="class" defaultTheme="light">{withVoice(<SettingsPage />, `/pelajar/${who}`)}</ThemeProvider>,
  loginAs(who, "/settings"),
);
const row = (title: string) => screen.getByText(title).parentElement!.parentElement!;

describe("Settings page", () => {
  it("switches the app language, keeping the current page", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Indonesia" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Inggris" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/en/pelajar/s2/settings"));
  });

  it("toggles dark mode", async () => {
    await open();
    fireEvent.click(await screen.findByRole("button", { name: "Mode Gelap" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Mode Terang" })).toBeInTheDocument();
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("switches between student and teacher mode", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Pelajar" }));
    expect(screen.getByRole("button", { name: "Pengajar" })).toBeInTheDocument();
  });

  it("explains that 'Hey Libra' needs a supported browser", async () => {
    await open();
    expect(screen.getByText("Browser ini belum mendukung. Gunakan Chrome, Edge, atau Safari.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktif" })).toBeDisabled();
  });

  it("remembers turning 'Hey Libra' off", async () => {
    vi.stubGlobal("webkitSpeechRecognition", class { start() {} stop() {} abort() {} });
    await open();
    await waitFor(() => expect(screen.getByRole("button", { name: "Nonaktif" })).toBeEnabled());
    expect(row("Hey Libra")).toHaveTextContent("Panggil LibraAI dengan suara");

    fireEvent.click(screen.getByRole("button", { name: "Nonaktif" }));
    expect(screen.getByRole("button", { name: "Nonaktif" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("libra.wakeWordEnabled")).toBe("false");
  });

  it("uses the kids styling for elementary students", async () => {
    await open("s1");
    expect(screen.getByRole("heading", { name: "⚙️ Pengaturan Umum" })).toBeInTheDocument();
  });
});
