import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { setNavigation } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { KidsGamesDashboard } from "./KidsGamesDashboard";

describe("KidsGamesDashboard", () => {
  it("links to every game under the student's own path", async () => {
    setNavigation({ params: { role: "pelajar", id: "s1" } });
    await renderWithProviders(<KidsGamesDashboard />, { classLevel: 2 });

    expect(screen.getByRole("heading", { name: "AYO BERMAIN 🎮" })).toBeInTheDocument();
    const links = Object.fromEntries(screen.getAllByRole("link").filter(a => a.getAttribute("href")?.includes("/games/"))
      .map(a => [a.querySelector("h3")!.textContent, a.getAttribute("href")]));
    expect(links).toEqual({
      Matematika: "/id/pelajar/s1/games/math",
      "Tebak Hewan": "/id/pelajar/s1/games/guess-animal",
      "Tebak Gambar": "/id/pelajar/s1/games/guess-picture",
      Menggambar: "/id/pelajar/s1/games/drawing",
      "Teka Teki Silang": "/id/pelajar/s1/games/crossword",
    });
  });

  it("is only for students", async () => {
    await renderWithProviders(<KidsGamesDashboard />, { role: "teacher" });
    expect(screen.getByText("Halaman ini khusus untuk siswa (Kids Mode).")).toBeInTheDocument();
    expect(screen.queryByText("Matematika")).toBeNull();
  });
});
