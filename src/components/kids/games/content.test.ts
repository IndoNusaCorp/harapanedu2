import { describe, it, expect } from "vitest";
import { animals, crosswordWords, drawingPrompts, isCorrectGuess, pictures, toGameLocale } from "./content";

describe("game content", () => {
  it("has content in both languages", () => {
    for (const set of [animals, pictures, drawingPrompts, crosswordWords]) {
      expect(set.id.length).toBeGreaterThan(0);
      expect(set.en.length).toBeGreaterThan(0);
    }
  });

  it("stores guess answers in the normalized form the checker compares against", () => {
    for (const item of [...animals.id, ...animals.en, ...pictures.id, ...pictures.en]) {
      for (const answer of [item.name, ...(item.aliases ?? [])]) {
        expect(answer, item.emoji).toBe(answer.toLowerCase().trim());
      }
    }
  });

  it("uses crossword words the letter boxes can produce (one upper-case letter per box)", () => {
    for (const { word } of [...crosswordWords.id, ...crosswordWords.en]) {
      expect(word).toMatch(/^[A-Z]+$/);
    }
  });
});

describe("isCorrectGuess", () => {
  const frog = { emoji: "🐸", name: "katak", aliases: ["kodok"] };

  it("ignores case and surrounding spaces", () => {
    expect(isCorrectGuess(frog, "  KATAK ")).toBe(true);
  });

  it("accepts aliases", () => {
    expect(isCorrectGuess(frog, "Kodok")).toBe(true);
  });

  it("rejects other answers", () => {
    expect(isCorrectGuess(frog, "kata")).toBe(false);
    expect(isCorrectGuess(frog, "")).toBe(false);
  });
});

describe("toGameLocale", () => {
  it("falls back to Indonesian", () => {
    expect(toGameLocale("en")).toBe("en");
    expect(toGameLocale("id")).toBe("id");
    expect(toGameLocale("fr")).toBe("id");
  });
});
