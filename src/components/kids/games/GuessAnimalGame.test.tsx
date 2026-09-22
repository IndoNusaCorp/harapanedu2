import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreDoc } from "@/test/fakeFirebase";
import { renderGame } from "@/test/games";
import { GuessAnimalGame } from "./GuessAnimalGame";

const guess = (value: string) => {
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /Cek Jawaban|Check/ }));
};

describe("GuessAnimalGame", () => {
  it("shows a picture to guess", async () => {
    await renderGame(<GuessAnimalGame />);
    expect(await screen.findByRole("heading", { name: "Tebak Hewan 🦁" })).toBeInTheDocument();
    expect(screen.getByText("🐶")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nama hewan...")).toBeInTheDocument();
  });

  it("accepts the answer regardless of case and spaces, then scores and saves", async () => {
    await renderGame(<GuessAnimalGame />);
    await screen.findByText("🐶");
    guess("  ANJING ");

    expect(await screen.findByText("✅ Benar!")).toBeInTheDocument();
    expect(screen.getByText("Skor: 10")).toBeInTheDocument();
    await waitFor(() => expect(getFirestoreDoc("users/s1/games/guess-animal")).toMatchObject({ currentLevel: 2, totalScore: 10 }));
    // A new question comes up after a short celebration
    await waitFor(() => expect(screen.queryByText("✅ Benar!")).toBeNull(), { timeout: 2500 });
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("rejects a wrong answer", async () => {
    await renderGame(<GuessAnimalGame />);
    await screen.findByText("🐶");
    guess("salah");
    expect(screen.getByText("❌ Salah, coba lagi!")).toBeInTheDocument();
    expect(screen.getByText("Skor: 0")).toBeInTheDocument();
  });

  it("expects the answer in English on the English site", async () => {
    await renderGame(<GuessAnimalGame />, { locale: "en" });
    await screen.findByText("🐶");
    guess("anjing");
    expect(await screen.findByText(/Wrong|try again/i)).toBeInTheDocument();
    guess("dog");
    expect(await screen.findByText(/Correct/)).toBeInTheDocument();
  });

  it("is not available to teachers", async () => {
    await renderGame(<GuessAnimalGame />, { role: "teacher" });
    expect(screen.getByText("Hanya untuk Kids Mode.")).toBeInTheDocument();
  });
});
