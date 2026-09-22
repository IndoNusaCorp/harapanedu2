import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { setNavigation } from "@/test/navigation";
import { KidsSidebar } from "./KidsSidebar";

const hrefOf = (name: RegExp) => screen.getByRole("link", { name }).getAttribute("href");

describe("KidsSidebar", () => {
  it("offers the kids menu, including games", async () => {
    await renderWithProviders(<KidsSidebar basePath="/pelajar/s1" />, { classLevel: 2 });

    expect(hrefOf(/Beranda/)).toBe("/pelajar/s1");
    expect(hrefOf(/Kelas Ku/)).toBe("/pelajar/s1/my-classes");
    expect(hrefOf(/Ayo Bermain/)).toBe("/pelajar/s1/games");
    expect(hrefOf(/Tugas/)).toBe("/pelajar/s1/assignment");
    expect(screen.getAllByRole("link")).toHaveLength(11);
  });

  it("marks a game page as part of 'Ayo Bermain'", async () => {
    setNavigation({ pathname: "/id/pelajar/s1/games/math" });
    await renderWithProviders(<KidsSidebar basePath="/pelajar/s1" />, { classLevel: 2 });

    expect(screen.getByRole("link", { name: /Ayo Bermain/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Beranda/ })).not.toHaveAttribute("aria-current");
  });

  it("sends teachers to my-work", async () => {
    await renderWithProviders(<KidsSidebar basePath="/pengajar/t1" />, { role: "teacher" });
    expect(hrefOf(/Kelas Ku/)).toBe("/pengajar/t1/my-work");
  });
});
