import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useTheme } from "next-themes";
import { ThemeProvider } from "./layout";

const prefersDark = (dark: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: dark && query.includes("dark"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));

function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  return <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{resolvedTheme}</button>;
}

const renderApp = () =>
  render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeSwitch />
    </ThemeProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

describe("ThemeProvider", () => {
  it("follows the system theme by default", () => {
    prefersDark(true);
    renderApp();
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button")).toHaveTextContent("dark");
  });

  it("switches theme on the <html> class and remembers the choice", () => {
    prefersDark(false);
    renderApp();
    expect(document.documentElement).toHaveClass("light");

    act(() => fireEvent.click(screen.getByRole("button")));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
