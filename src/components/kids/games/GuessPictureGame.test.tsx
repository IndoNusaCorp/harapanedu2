import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreDoc } from "@/test/fakeFirebase";
import { renderGame } from "@/test/games";
import { GuessPictureGame } from "./GuessPictureGame";

const guess = (value: string) => {
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /Cek Jawaban|Check/ }));
};

describe("GuessPictureGame", () => {
  it("shows a picture to guess", async () => {
    await renderGame(<GuessPictureGame />);
    expect(await screen.findByRole("heading", { name: "Tebak Gambar 🖼️" })).toBeInTheDocument();
    expect(screen.getByText("🍎")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ini gambar apa?")).toBeInTheDocument();
  });

  it("accepts the answer regardless of case and spaces, then scores and saves", async () => {
    await renderGame(<GuessPictureGame />);
    await screen.findByText("🍎");
    guess("  APEL ");

    expect(await screen.findByText("✅ Benar!")).toBeInTheDocument();
    expect(screen.getByText("Skor: 10")).toBeInTheDocument();
    await waitFor(() => expect(getFirestoreDoc("users/s1/games/guess-picture")).toMatchObject({ currentLevel: 2, totalScore: 10 }));
    // A new question comes up after a short celebration
    await waitFor(() => expect(screen.queryByText("✅ Benar!")).toBeNull(), { timeout: 2500 });
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("rejects a wrong answer", async () => {
    await renderGame(<GuessPictureGame />);
    await screen.findByText("🍎");
    guess("salah");
    expect(screen.getByText("❌ Salah, coba lagi!")).toBeInTheDocument();
    expect(screen.getByText("Skor: 0")).toBeInTheDocument();
  });

  it("expects the answer in English on the English site", async () => {
    await renderGame(<GuessPictureGame />, { locale: "en" });
    await screen.findByText("🍎");
    guess("apel");
    expect(await screen.findByText(/Wrong|try again/i)).toBeInTheDocument();
    guess("apple");
    expect(await screen.findByText(/Correct/)).toBeInTheDocument();
  });

  it("is not available to teachers", async () => {
    await renderGame(<GuessPictureGame />, { role: "teacher" });
    expect(screen.getByText("Hanya untuk Kids Mode.")).toBeInTheDocument();
  });
});
