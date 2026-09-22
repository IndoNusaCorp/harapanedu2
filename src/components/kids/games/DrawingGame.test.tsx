import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreDoc } from "@/test/fakeFirebase";
import { renderGame } from "@/test/games";
import { DrawingGame } from "./DrawingGame";

let ctx: Record<string, unknown>;
beforeEach(() => {
  ctx = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), clearRect: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
});

const canvas = () => document.querySelector("canvas")!;
const done = () => screen.getByRole("button", { name: "Selesai Gambar!" });

describe("DrawingGame", () => {
  it("asks the child to draw something", async () => {
    await renderGame(<DrawingGame />);
    expect(await screen.findByText("Apel")).toBeInTheDocument();
    expect(screen.getByText("🍎")).toBeInTheDocument();
  });

  it("only allows finishing after drawing", async () => {
    await renderGame(<DrawingGame />);
    await screen.findByText("Apel");
    expect(done()).toBeDisabled();

    fireEvent.mouseDown(canvas(), { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(canvas(), { clientX: 30, clientY: 40 });
    fireEvent.mouseUp(canvas());
    expect(done()).toBeEnabled();
    expect(ctx.lineTo).toHaveBeenCalledWith(30, 40);
  });

  it("draws in the chosen colour", async () => {
    await renderGame(<DrawingGame />);
    await screen.findByText("Apel");
    fireEvent.click(screen.getAllByRole("button", { name: "Pilih warna" })[1]);
    fireEvent.mouseDown(canvas(), { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(canvas(), { clientX: 5, clientY: 5 });
    expect(ctx.strokeStyle).toBe("#FF0000");
  });

  it("clears the drawing", async () => {
    await renderGame(<DrawingGame />);
    await screen.findByText("Apel");
    fireEvent.mouseDown(canvas(), { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Hapus" }));
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 600, 400);
    expect(done()).toBeDisabled();
  });

  it("gives 20 points for a finished drawing", async () => {
    await renderGame(<DrawingGame />);
    await screen.findByText("Apel");
    fireEvent.mouseDown(canvas(), { clientX: 0, clientY: 0 });
    fireEvent.click(done());

    expect(await screen.findByText("Bagus Sekali!")).toBeInTheDocument();
    await waitFor(() => expect(getFirestoreDoc("users/s1/games/drawing")).toMatchObject({ currentLevel: 2, totalScore: 20 }));
  });
});
