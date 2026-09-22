import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import HelpPage from "./page";

describe("Help page", () => {
  it("lists the help topics", async () => {
    await renderWithProviders(<HelpPage />, loginAs("s2", "/help"));
    expect(screen.getByRole("heading", { name: "Pusat Bantuan" })).toBeInTheDocument();
    expect(screen.getAllByRole("button").filter(b => b.className.includes("min-h-[110px]")).map(b => b.firstElementChild?.nextSibling?.textContent))
      .toEqual(["Memulai", "Bantuan LibraAI", "FAQ", "Hubungi Kami"]);
  });

  it("follows the language", async () => {
    await renderWithProviders(<HelpPage />, { ...loginAs("t1", "/help"), locale: "en" });
    expect(screen.getByRole("heading", { name: "Help Center" })).toBeInTheDocument();
  });
});
