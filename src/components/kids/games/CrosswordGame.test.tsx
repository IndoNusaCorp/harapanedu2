import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreDoc } from "@/test/fakeFirebase";
import { renderGame } from "@/test/games";
import { CrosswordGame } from "./CrosswordGame";

const boxes = () => screen.getAllByRole("textbox") as HTMLInputElement[];
const fill = (word: string) => word.split("").forEach((ch, i) => fireEvent.change(boxes()[i], { target: { value: ch } }));
const check = () => fireEvent.click(screen.getByRole("button", { name: "Cek Jawaban!" }));

describe("CrosswordGame", () => {
  it("shows the hint and one box per letter", async () => {
    await renderGame(<CrosswordGame />);
    expect(await screen.findByText("Mainan yang ditendang")).toBeInTheDocument();
    expect(boxes()).toHaveLength(4); // BOLA
  });

  it("upper-cases letters and moves to the next box", async () => {
    await renderGame(<CrosswordGame />);
    await screen.findByText("Mainan yang ditendang");
    fireEvent.change(boxes()[0], { target: { value: "b" } });
    expect(boxes()[0]).toHaveValue("B");
    expect(boxes()[1]).toHaveFocus();

    // Typing over a filled box keeps only the new letter
    fireEvent.change(boxes()[0], { target: { value: "Bx" } });
    expect(boxes()[0]).toHaveValue("X");
  });

  it("goes back a box on Backspace in an empty box", async () => {
    await renderGame(<CrosswordGame />);
    await screen.findByText("Mainan yang ditendang");
    boxes()[2].focus();
    fireEvent.keyDown(boxes()[2], { key: "Backspace" });
    expect(boxes()[1]).toHaveFocus();
  });

  it("gives 15 points for the right word and saves progress", async () => {
    await renderGame(<CrosswordGame />);
    await screen.findByText("Mainan yang ditendang");
    fill("bola");
    check();

    expect(await screen.findByText("✅ Benar!")).toBeInTheDocument();
    expect(screen.getByText("Skor: 15")).toBeInTheDocument();
    await waitFor(() => expect(getFirestoreDoc("users/s1/games/crossword")).toMatchObject({ currentLevel: 2, totalScore: 15 }));
  });

  it("flags a wrong or incomplete word", async () => {
    await renderGame(<CrosswordGame />);
    await screen.findByText("Mainan yang ditendang");
    fill("bol");
    check();
    expect(screen.getByText("❌ Ada yang salah!")).toBeInTheDocument();
  });
});
