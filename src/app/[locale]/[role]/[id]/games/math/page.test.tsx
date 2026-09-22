import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { setStaticParamsLocale } from "next-international/server";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import MathGamePage from "./page";

// next-international/server only runs in React Server Components
vi.mock("next-international/server", () => ({ setStaticParamsLocale: vi.fn() }));

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});

const params = (locale: string) => Promise.resolve({ locale, role: "pelajar", id: "s1" });

describe("[locale]/[role]/[id]/games/math/page", () => {
  it("renders statically for the requested locale", async () => {
    await MathGamePage({ params: params("en") });
    expect(setStaticParamsLocale).toHaveBeenCalledWith("en");
  });

  it("shows the game to a kids-mode student", async () => {
    const page = await MathGamePage({ params: params("id") });
    await renderWithProviders(page, loginAs("s1", "/games/math"));
    expect(await screen.findByRole("heading", { name: "Matematika Seru! 🔢" })).toBeInTheDocument();
  });
});
