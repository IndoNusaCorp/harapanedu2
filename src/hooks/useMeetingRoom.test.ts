import { describe, it, expect } from "vitest";
import { liveParticipants, shouldCall, STALE_MS } from "./useMeetingRoom";
import type { MeetingParticipantState } from "@/lib/types";

const state = (name: string, role: "teacher" | "student", lastSeen: number): MeetingParticipantState => ({
  name, role, lastSeen, mute: true, camera: false, hand: false, effect: "none",
});

describe("liveParticipants", () => {
  const now = 1_000_000;

  it("keeps active, fresh participants, excludes self, and lists the teacher first", () => {
    const list = liveParticipants({
      activeParticipants: ["me", "s2", "t1", "gone", "stale"],
      participantStates: {
        me: state("Me", "student", now),
        s2: state("Zara", "student", now - 1000),
        t1: state("Bu Guru", "teacher", now - 2000),
        stale: state("Old", "student", now - STALE_MS - 1),
        left: state("Left", "student", now),
      },
    }, now, "me");

    expect(list.map(p => p.uid)).toEqual(["t1", "s2"]);
    expect(list.every(p => !p.isMe)).toBe(true);
  });

  it("handles a meeting nobody has joined", () => {
    expect(liveParticipants({}, now, "me")).toEqual([]);
  });
});

describe("shouldCall", () => {
  it("lets exactly one side of each pair start the call", () => {
    expect(shouldCall("a", "b")).toBe(true);
    expect(shouldCall("b", "a")).toBe(false);
  });
});
