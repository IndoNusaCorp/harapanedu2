import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import AboutPage from "./page";

describe("About page", () => {
  it("describes the app and its version", async () => {
    await renderWithProviders(<AboutPage />, loginAs("s2", "/about"));
    expect(screen.getByText("Pelajari lebih lanjut tentang misi, visi, dan tim di balik platform ini.")).toBeInTheDocument();
    expect(screen.getByText("Versi 1.0.0")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent)).toEqual(["Misi Kami", "Privasi Utama", "Buatan Indonesia"]);
  });

  it("shows the teddy mascot in kids mode", async () => {
    await renderWithProviders(<AboutPage />, loginAs("s1", "/about"));
    expect(screen.getByText("🧸")).toBeInTheDocument();
  });

  it("follows the language", async () => {
    await renderWithProviders(<AboutPage />, { ...loginAs("s2", "/about"), locale: "en" });
    expect(screen.getByText("Version 1.0.0")).toBeInTheDocument();
  });
});
