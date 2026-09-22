import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFirestoreDoc, seedFirestore, signInAs } from "@/test/fakeFirebase";
import { getGameProgress, saveGameProgress } from "./gameServices";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("game progress", () => {
  it("starts at level 1 with no score for a new player", async () => {
    signInAs("s1");
    expect(await getGameProgress("math")).toEqual({ currentLevel: 1, totalScore: 0 });
  });

  it("reads the player's saved progress for that game only", async () => {
    seedFirestore({
      "users/s1/games": { math: { currentLevel: 4, totalScore: 120 }, crossword: { currentLevel: 2, totalScore: 10 } },
      "users/s2/games": { math: { currentLevel: 9, totalScore: 999 } },
    });
    signInAs("s1");
    expect(await getGameProgress("math")).toEqual({ currentLevel: 4, totalScore: 120 });
  });

  it("saves progress under the logged-in player and merges with existing fields", async () => {
    seedFirestore({ "users/s1/games": { math: { currentLevel: 1, totalScore: 0, badges: ["first"] } } });
    signInAs("s1");

    await saveGameProgress("math", { currentLevel: 3, totalScore: 50 });
    expect(getFirestoreDoc("users/s1/games/math")).toMatchObject({
      currentLevel: 3,
      totalScore: 50,
      badges: ["first"],
      updatedAt: expect.any(String),
    });
    expect(await getGameProgress("math")).toEqual({ currentLevel: 3, totalScore: 50 });
  });

  it("uses default progress and saves nothing when logged out", async () => {
    await saveGameProgress("math", { currentLevel: 5, totalScore: 10 });
    expect(await getGameProgress("math")).toEqual({ currentLevel: 1, totalScore: 0 });
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});
