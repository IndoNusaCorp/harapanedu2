import { describe, it, expect } from "vitest";
import { chatsToEvict, chatTitle, MAX_AI_CHATS } from "./useAiChats";
import type { AiChatSession } from "@/lib/types";

const session = (id: string, updated_at: string): AiChatSession => ({
  id, updated_at, created_at: updated_at, user_id: "u", assistant: "libra", title: id, messages: [],
});

describe("chat history limit", () => {
  it("keeps up to 5 chats", () => {
    expect(MAX_AI_CHATS).toBe(5);
  });

  it("evicts nothing while there is room for a new chat", () => {
    expect(chatsToEvict([session("a", "2026-01-01"), session("b", "2026-01-02")])).toEqual([]);
  });

  it("evicts the least recently used chat when full", () => {
    const list = ["2026-01-03", "2026-01-01", "2026-01-05", "2026-01-02", "2026-01-04"].map((d, i) => session(`c${i}`, d));
    expect(chatsToEvict(list).map(s => s.id)).toEqual(["c1"]);
  });

  it("evicts enough chats if the history is somehow over the limit", () => {
    const list = Array.from({ length: 7 }, (_, i) => session(`c${i}`, `2026-01-0${i + 1}`));
    expect(chatsToEvict(list).map(s => s.id)).toEqual(["c2", "c1", "c0"]);
  });

  it("builds a short title from the first message", () => {
    expect(chatTitle("  Halo   LibraAI \n apa kabar ")).toBe("Halo LibraAI apa kabar");
    expect(chatTitle("x".repeat(100))).toHaveLength(60);
  });
});
