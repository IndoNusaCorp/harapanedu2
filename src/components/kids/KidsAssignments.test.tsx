import { describe, it, expect } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import KidsAssignments from "./KidsAssignments";

const row = (title: string) => screen.getByText(title).closest("a") as HTMLElement;

describe("KidsAssignments", () => {
  it("lists assignments with the child's own status and links to each", async () => {
    await renderWithProviders(<KidsAssignments />, loginAs("s1", "/assignment"));

    expect(await screen.findByText("PR Pecahan")).toBeInTheDocument();
    expect(within(row("PR Pecahan")).getByText("⏰ Sedang dikerjakan")).toBeInTheDocument(); // Ani started it
    expect(within(row("PR Tumbuhan")).getByText("⏰ Belum dikerjakan")).toBeInTheDocument();
    expect(row("PR Pecahan")).toHaveAttribute("href", "/pelajar/s1/assignment/a1");
    expect(within(row("PR Pecahan")).getByText("30 September 2026")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    await renderWithProviders(<KidsAssignments />, loginAs("s1", "/assignment"));
    await screen.findByText("PR Pecahan");

    fireEvent.click(screen.getByRole("button", { name: "Sedang Dikerjakan" }));
    expect(screen.getByText("PR Pecahan")).toBeInTheDocument();
    expect(screen.queryByText("PR Tumbuhan")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Dinilai" }));
    expect(screen.getByText("Tidak ada tugas!")).toBeInTheDocument();
  });

  it("searches by title or subject", async () => {
    await renderWithProviders(<KidsAssignments />, loginAs("s1", "/assignment"));
    await screen.findByText("PR Pecahan");
    fireEvent.change(screen.getByPlaceholderText("CARI TUGAS..."), { target: { value: "ipa" } });
    expect(screen.getByText("PR Tumbuhan")).toBeInTheDocument();
    expect(screen.queryByText("PR Pecahan")).toBeNull();
  });
});
