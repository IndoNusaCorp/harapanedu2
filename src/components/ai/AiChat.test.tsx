import React, { createRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreData, seedFirestore, signInAs } from "@/test/fakeFirebase";
import { setNavigation } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import type { AiFileRef } from "@/lib/types";
import { AiChat, type AiChatApi, type AiChatProps } from "./AiChat";

const FILES: AiFileRef[] = [
  { id: "class_materi:c1", name: "bab1.pdf", kind: "class_materi", label: "Matematika" },
  { id: "class_materi:c2", name: "bab2.pdf", kind: "class_materi", label: "Matematika" },
  { id: "assignment_materi:a1", name: "soal.docx", kind: "assignment_materi", label: "PR Pecahan" },
  { id: "submission:x", name: "jawaban.pdf", kind: "submission", label: "PR Pecahan" },
];

let fetchMock: ReturnType<typeof vi.fn>;
let reply: () => Promise<Response>;
const posts = () => fetchMock.mock.calls.filter(c => c[1]?.method === "POST").map(c => JSON.parse(c[1].body));

beforeEach(() => {
  signInAs("s1");
  setNavigation({ params: { role: "pelajar", id: "s1" } });
  seedFirestore({ users: { s1: { first_name: "Ani", role_id: "1", class: 9 } } });
  reply = async () => Response.json({ success: true, data: { text: "**Pecahan** adalah bagian dari keseluruhan." } });
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST" ? reply() : Response.json({ success: true, data: { role: "student", files: FILES } }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const renderChat = (props: Partial<AiChatProps> = {}) => renderWithProviders(
  <AiChat
    assistant="libra"
    title="Asisten LibraAI"
    description="Teman belajar"
    placeholder="Tanya apa saja"
    disclaimer="Periksa kembali"
    errorText="Maaf, LibraAI sedang bermasalah."
    suggestions={["Apa itu pecahan?"]}
    {...props}
  />,
  { classLevel: 9 },
);
const input = () => screen.getByPlaceholderText("Tanya apa saja");
const typeAndSend = (text: string) => {
  fireEvent.change(input(), { target: { value: text } });
  fireEvent.keyDown(input(), { key: "Enter" });
};
const chat = (id: string, title: string, updated_at: string, messages = [{ role: "user", content: title, created_at: updated_at }]) =>
  ({ user_id: "s1", assistant: "libra", title, messages, created_at: updated_at, updated_at });

describe("AiChat: conversation", () => {
  it("shows suggestions on an empty chat and sends one when clicked", async () => {
    await renderChat();
    fireEvent.click(await screen.findByRole("button", { name: "Apa itu pecahan?" }));

    expect(await screen.findByText("Pecahan")).toBeInTheDocument();
    expect(posts()[0]).toEqual({ message: "Apa itu pecahan?", history: [], fileIds: [], locale: "id" });
  });

  it("renders the AI's markdown reply and saves the chat", async () => {
    await renderChat();
    typeAndSend("  Jelaskan pecahan  ");

    expect(screen.getByText("Jelaskan pecahan")).toBeInTheDocument();
    expect(input()).toHaveValue("");
    expect((await screen.findByText("Pecahan")).tagName).toBe("STRONG");

    await waitFor(() => expect(Object.values(getFirestoreData("ai_chats"))).toEqual([
      expect.objectContaining({ user_id: "s1", assistant: "libra", title: "Jelaskan pecahan", messages: [
        expect.objectContaining({ role: "user", content: "Jelaskan pecahan" }),
        expect.objectContaining({ role: "model", content: "**Pecahan** adalah bagian dari keseluruhan." }),
      ] }),
    ]));
  });

  it("sends the conversation so far as history", async () => {
    await renderChat();
    typeAndSend("Pertanyaan 1");
    await screen.findByText("Pecahan");
    typeAndSend("Pertanyaan 2");

    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()[1].history).toEqual([
      { role: "user", content: "Pertanyaan 1" },
      { role: "model", content: "**Pecahan** adalah bagian dari keseluruhan." },
    ]);
  });

  it("does not send on Shift+Enter or when empty", async () => {
    await renderChat();
    fireEvent.change(input(), { target: { value: "baris 1" } });
    fireEvent.keyDown(input(), { key: "Enter", shiftKey: true });
    fireEvent.change(input(), { target: { value: "   " } });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(screen.getByRole("button", { name: "Kirim" })).toBeDisabled();
    expect(posts()).toEqual([]);
  });

  it("shows an error bubble and leaves it out of the next request", async () => {
    reply = async () => Response.json({ success: false, error: "down" }, { status: 500 });
    await renderChat();
    typeAndSend("Halo");
    expect(await screen.findByText("Maaf, LibraAI sedang bermasalah.")).toBeInTheDocument();

    reply = async () => Response.json({ success: true, data: { text: "Halo juga" } });
    typeAndSend("Halo lagi");
    await screen.findByText("Halo juga");
    expect(posts()[1].history).toEqual([{ role: "user", content: "Halo" }]);
    expect(screen.queryByText("Maaf, LibraAI sedang bermasalah.")).toBeNull();
  });

  it("lets the page transform replies and add buttons under them", async () => {
    reply = async () => Response.json({ success: true, data: { text: "Ini daftarnya [BANTU_NILAI]" } });
    await renderChat({
      transformContent: c => c.replace("[BANTU_NILAI]", ""),
      renderMessageExtra: c => (c.includes("[BANTU_NILAI]") ? <button>Bantu nilai</button> : null),
    });
    typeAndSend("Tampilkan");
    expect(await screen.findByRole("button", { name: "Bantu nilai" })).toBeInTheDocument();
    expect(screen.queryByText(/\[BANTU_NILAI\]/)).toBeNull();
  });

  it("lets the page append an AI message", async () => {
    const apiRef = createRef<AiChatApi>();
    await renderChat({ apiRef });
    act(() => apiRef.current!.appendModelMessage("✅ **3 nilai** disimpan"));
    expect(await screen.findByText("3 nilai")).toBeInTheDocument();
  });
});

describe("AiChat: attachments", () => {
  it("attaches up to 3 files from the materials list", async () => {
    await renderChat();
    fireEvent.click(screen.getByRole("button", { name: "Lampirkan file dari materi" }));

    expect(await screen.findByText("Materi kelas")).toBeInTheDocument();
    expect(screen.getByText("Soal tugas")).toBeInTheDocument();
    ["bab1.pdf", "bab2.pdf", "soal.docx"].forEach(name => fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(name) })));
    expect(screen.getByRole("checkbox", { name: /jawaban\.pdf/ })).toBeDisabled();

    typeAndSend("Rangkum");
    await screen.findByText("Pecahan");
    expect(posts()[0].fileIds).toEqual(["class_materi:c1", "class_materi:c2", "assignment_materi:a1"]);
    expect(screen.getAllByText("bab1.pdf")).toHaveLength(1); // shown on the sent message
  });
});

describe("AiChat: history", () => {
  it("reopens the most recent chat and switches between chats", async () => {
    seedFirestore({
      ai_chats: {
        old: chat("old", "Chat lama", "2026-09-01T00:00:00Z"),
        recent: chat("recent", "Chat terbaru", "2026-09-05T00:00:00Z"),
      },
    });
    await renderChat();
    expect(await screen.findByText("Chat terbaru")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Riwayat 2\/5/ }));
    fireEvent.click(screen.getByRole("button", { name: /Chat lama/ }));
    expect(screen.getByText("Chat lama")).toBeInTheDocument();
    expect(screen.queryByText("Chat terbaru")).toBeNull();
  });

  it("deletes a chat after confirmation", async () => {
    seedFirestore({ ai_chats: { a: chat("a", "Hapus aku", "2026-09-01T00:00:00Z") } });
    vi.stubGlobal("confirm", vi.fn(() => true));
    await renderChat();
    await screen.findByText("Hapus aku");

    fireEvent.click(screen.getByRole("button", { name: /Riwayat 1\/5/ }));
    fireEvent.click(screen.getByRole("button", { name: "Hapus chat" }));

    expect(window.confirm).toHaveBeenCalledWith('Hapus chat "Hapus aku"?');
    await waitFor(() => expect(getFirestoreData("ai_chats")).toEqual({}));
    expect(await screen.findByRole("button", { name: "Apa itu pecahan?" })).toBeInTheDocument();
  });

  it("asks before replacing the oldest chat when the history is full", async () => {
    seedFirestore({
      ai_chats: Object.fromEntries([1, 2, 3, 4, 5].map(d => [`c${d}`, chat(`c${d}`, `Chat ${d}`, `2026-09-0${d}T00:00:00Z`)])),
    });
    await renderChat();
    await screen.findByText("Chat 5");

    fireEvent.click(screen.getByRole("button", { name: "Chat baru" }));
    expect(screen.getByText(/Chat paling lama, "Chat 1", akan dihapus/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hapus & buat baru" }));

    await waitFor(() => expect(Object.keys(getFirestoreData("ai_chats")).sort()).toEqual(["c2", "c3", "c4", "c5"]));
    expect(await screen.findByRole("button", { name: "Apa itu pecahan?" })).toBeInTheDocument();
  });
});
