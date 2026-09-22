import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreDoc, seedFirestore } from "@/test/fakeFirebase";
import { renderGame } from "@/test/games";
import { MathGame } from "./MathGame";

const answer = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText("Jawaban"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Cek Jawaban!" }));
};

describe("MathGame", () => {
  it("starts new players on an easy addition", async () => {
    await renderGame(<MathGame />);
    expect(await screen.findByText("Level: 1")).toBeInTheDocument();
    expect(screen.getByText("Skor: 0")).toBeInTheDocument();
    expect(screen.getByText("+").parentElement).toHaveTextContent("1+1=?");
    expect(screen.getByRole("link", { name: "← Kembali ke Daftar Game" })).toHaveAttribute("href", "/id/pelajar/s1/games");
  });

  it("levels up and saves progress on a correct answer", async () => {
    await renderGame(<MathGame />);
    await screen.findByText("Level: 1");
    answer("2");

    expect(await screen.findByText("✅ Benar!")).toBeInTheDocument();
    expect(screen.getByText("Level: 2")).toBeInTheDocument();
    expect(screen.getByText("Skor: 10")).toBeInTheDocument();
    await waitFor(() => expect(getFirestoreDoc("users/s1/games/math")).toMatchObject({ currentLevel: 2, totalScore: 10 }));
  });

  it("says so on a wrong answer and keeps the score", async () => {
    await renderGame(<MathGame />);
    await screen.findByText("Level: 1");
    answer("3");

    expect(screen.getByText("❌ Salah, coba lagi!")).toBeInTheDocument();
    expect(screen.getByText("Skor: 0")).toBeInTheDocument();
    expect(getFirestoreDoc("users/s1/games/math")).toBeUndefined();
  });

  it("ignores an empty answer", async () => {
    await renderGame(<MathGame />);
    await screen.findByText("Level: 1");
    answer("");
    expect(screen.queryByText("❌ Salah, coba lagi!")).toBeNull();
  });

  it("continues from saved progress, with harder operations at higher levels", async () => {
    seedFirestore({ "users/s1/games": { math: { currentLevel: 8, totalScore: 70 } } });
    // random 0.99 picks the last operation available at level 8: division
    await renderGame(<MathGame />, { random: 0.99 });

    expect(await screen.findByText("Level: 8")).toBeInTheDocument();
    expect(screen.getByText("/").parentElement).toHaveTextContent("100/10=?");
    answer("10");
    expect(await screen.findByText("Skor: 80")).toBeInTheDocument();
  });

  it("is not available to teachers", async () => {
    await renderGame(<MathGame />, { role: "teacher" });
    expect(screen.getByText("Hanya untuk Kids Mode.")).toBeInTheDocument();
  });
});
