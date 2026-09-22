import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { getFirestoreData, seedFirestore } from "@/test/fakeFirebase";
import { chatsToEvict, chatTitle, MAX_AI_CHATS, useAiChats } from "./useAiChats";
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
    expect(chatTitle("x".repeat(100)).endsWith("…")).toBe(true);
    expect(chatTitle("x".repeat(60))).toBe("x".repeat(60));
  });
});

describe("useAiChats", () => {
  const chat = (user_id: string, assistant: "libra" | "scorpio", updated_at: string) =>
    ({ user_id, assistant, title: `${assistant} ${updated_at}`, messages: [], created_at: updated_at, updated_at });
  const msg = (role: "user" | "model", content: string) => ({ role, content, created_at: "2026-09-21T00:00:00Z" });

  const load = async (assistant: "libra" | "scorpio" = "libra", uid = "s1") => {
    const hook = renderHook(() => useAiChats(assistant, uid));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
  };

  it("loads only this user's chats for this assistant and opens the most recent one", async () => {
    seedFirestore({
      ai_chats: {
        a: chat("s1", "libra", "2026-09-01"),
        b: chat("s1", "libra", "2026-09-03"),
        c: chat("s1", "scorpio", "2026-09-05"),
        d: chat("s2", "libra", "2026-09-09"),
      },
    });
    const { result } = await load();

    expect(result.current.sessions.map(s => s.id)).toEqual(["b", "a"]);
    expect(result.current.activeId).toBe("b");
    expect(result.current.isFull).toBe(false);
  });

  it("creates the chat on the first message, then updates the same chat", async () => {
    const { result } = await load();
    expect(result.current.activeId).toBeNull();

    // First message and the AI reply are saved back to back: they must not create two chats
    await act(async () => {
      result.current.saveMessages([msg("user", "Apa itu   pecahan?")]);
      await result.current.saveMessages([msg("user", "Apa itu   pecahan?"), msg("model", "Bagian dari keseluruhan.")]);
    });

    const stored = Object.entries(getFirestoreData("ai_chats"));
    expect(stored).toHaveLength(1);
    const [id, data] = stored[0];
    expect(data).toMatchObject({ user_id: "s1", assistant: "libra", title: "Apa itu pecahan?" });
    expect(data.messages).toHaveLength(2);
    expect(result.current.activeId).toBe(id);
  });

  it("deletes the least recently used chat when starting a new one with a full history", async () => {
    seedFirestore({
      ai_chats: Object.fromEntries(["05", "01", "04", "02", "03"].map(d => [`c${d}`, chat("s1", "libra", `2026-09-${d}`)])),
    });
    const { result } = await load();
    expect(result.current.isFull).toBe(true);
    expect(result.current.evictionCandidates.map(s => s.id)).toEqual(["c01"]);

    await act(() => result.current.startNewChat());

    expect(Object.keys(getFirestoreData("ai_chats")).sort()).toEqual(["c02", "c03", "c04", "c05"]);
    expect(result.current.activeId).toBeNull();
    expect(result.current.isFull).toBe(false);
  });

  it("clears the active chat when it is deleted", async () => {
    seedFirestore({ ai_chats: { a: chat("s1", "libra", "2026-09-01") } });
    const { result } = await load();

    await act(() => result.current.deleteChat("a"));
    expect(result.current.activeId).toBeNull();
    expect(getFirestoreData("ai_chats")).toEqual({});
  });
});
