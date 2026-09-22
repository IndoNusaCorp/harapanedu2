import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { signInAs } from "@/test/fakeFirebase";
import { renderHookWithProviders } from "@/test/render";
import { installFakeAudio, pcmBase64 } from "@/test/voice";
import { useLibraVoice } from "./useLibraVoice";

const live = await vi.hoisted(async () => (await import("@/test/voice")).fakeLive());
vi.mock("@google/genai", () => live.module);

const TOKEN_REPLY = {
  success: true,
  data: { token: "auth_tokens/abc", model: "gemini-live", systemInstruction: "Kamu adalah LibraAI Voice", tools: [{ functionDeclarations: [] }] },
};

let audio: ReturnType<typeof installFakeAudio>;
let fetchMock: ReturnType<typeof vi.fn>;
let toolReply: unknown;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  signInAs("s1");
  audio = installFakeAudio();
  toolReply = { success: true, data: { panel: { type: "documents", query: "", items: [], openId: null }, result: { jumlah_ditemukan: 0 } } };
  fetchMock = vi.fn(async (url: string) => Response.json(url === "/api/libraai-voice" ? TOKEN_REPLY : toolReply));
  vi.stubGlobal("fetch", fetchMock);
  live.sessions.length = 0;
});

async function setup() {
  const hook = await renderHookWithProviders(() => useLibraVoice({ role: "student", classLevel: 4 }));
  return hook;
}

async function started(initialText?: string) {
  const hook = await setup();
  await act(() => hook.result.current.startVoiceChat(initialText));
  return { ...hook, session: live.sessions[0] };
}

describe("useLibraVoice: starting", () => {
  it("asks for the mic, gets a token as the logged-in user and connects to Gemini Live with it", async () => {
    const { result, session } = await started();

    expect(audio.getUserMedia).toHaveBeenCalledWith({ audio: expect.objectContaining({ sampleRate: 16000, channelCount: 1, echoCancellation: true }) });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/libraai-voice");
    expect(init.headers.Authorization).toBe("Bearer token-s1");
    expect(session.apiKey).toBe("auth_tokens/abc");
    expect(session.params.model).toBe("gemini-live");
    expect(session.params.config).toMatchObject({ systemInstruction: "Kamu adalah LibraAI Voice", responseModalities: ["AUDIO"] });
    expect(result.current).toMatchObject({ status: "listening", isActive: true, error: null });
    expect(audio.contexts[0].audioWorklet.addModule).toHaveBeenCalledWith("/pcm-processor.js");
  });

  it("explains a blocked microphone and does not request a token", async () => {
    audio.getUserMedia.mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    const { result } = await started();

    expect(result.current.status).toBe("error");
    expect(result.current.isActive).toBe(false);
    expect(result.current.error).toBe("Akses mikrofon ditolak. Izinkan akses mikrofon di browser.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("releases the mic when the server refuses to start a session", async () => {
    fetchMock.mockImplementationOnce(async () => Response.json({ success: false, error: "Sesi login tidak valid." }, { status: 401 }));
    const { result } = await started();

    expect(result.current.error).toBe("Gagal memulai voice chat. Silakan coba lagi.");
    expect(audio.track.stop).toHaveBeenCalled();
    expect(live.sessions).toHaveLength(0);
  });

  it("passes on a question spoken together with the wake phrase", async () => {
    const { result, session } = await started("  Hey Libra, tugas saya apa?  ");

    expect(session.sendClientContent).toHaveBeenCalledWith({
      turns: [{ role: "user", parts: [{ text: "Hey Libra, tugas saya apa?" }] }],
      turnComplete: true,
    });
    expect(result.current.userTranscript).toBe("Hey Libra, tugas saya apa?");
    expect(result.current.wakeDetected).toBe(true);
  });

  it("ignores a click event passed as the initial text", async () => {
    const { session } = await started({ type: "click" } as unknown as string);
    expect(session.sendClientContent).not.toHaveBeenCalled();
  });
});

describe("useLibraVoice: conversation", () => {
  it("streams mic audio to Gemini as 16 kHz PCM", async () => {
    const { session } = await started();
    const pcm = new Int16Array([0, 1000, -1000]).buffer;
    audio.worklets[0].port.onmessage!({ data: pcm } as MessageEvent);

    expect(session.sendRealtimeInput).toHaveBeenCalledWith({
      audio: { data: btoa(String.fromCharCode(...new Uint8Array(pcm))), mimeType: "audio/pcm;rate=16000" },
    });
  });

  it("builds transcripts per turn and clears them when a new turn starts", async () => {
    const { result, session } = await started();

    act(() => session.message({ serverContent: { inputTranscription: { text: "Apa itu " } } }));
    act(() => session.message({ serverContent: { inputTranscription: { text: "pecahan?" } } }));
    act(() => session.message({ serverContent: { outputTranscription: { text: "Pecahan adalah " } } }));
    act(() => session.message({ serverContent: { outputTranscription: { text: "bagian." }, turnComplete: true } }));
    expect(result.current.userTranscript).toBe("Apa itu pecahan?");
    expect(result.current.aiTranscript).toBe("Pecahan adalah bagian.");

    act(() => session.message({ serverContent: { inputTranscription: { text: "Terima kasih" } } }));
    expect(result.current.userTranscript).toBe("Terima kasih");
    expect(result.current.aiTranscript).toBe("");
  });

  it("plays Gemini's audio, then goes back to listening", async () => {
    const { result, session } = await started();

    act(() => session.message({ serverContent: { modelTurn: { parts: [{ inlineData: { data: pcmBase64([16384, -16384]) } }] } } }));
    expect(result.current.status).toBe("ai-speaking");
    expect(result.current.getLevel()).toBeGreaterThan(0);
    const source = audio.bufferSources[0];
    expect(source.start).toHaveBeenCalled();

    act(() => source.onended!());
    expect(result.current.status).toBe("listening");
  });

  it("stops talking when the user says 'Hey Libra' mid-answer", async () => {
    const { result, session } = await started();
    act(() => session.message({ serverContent: { modelTurn: { parts: [{ inlineData: { data: pcmBase64([100]) } }] } } }));
    expect(result.current.status).toBe("ai-speaking");

    act(() => session.message({ serverContent: { inputTranscription: { text: "hai libra" } } }));
    expect(audio.bufferSources[0].stop).toHaveBeenCalled();
    expect(result.current.status).toBe("listening");
    expect(result.current.wakeDetected).toBe(true);
  });

  it("sends typed questions into the running session", async () => {
    const { result, session } = await started();
    act(() => result.current.sendText("Jadwal besok?"));
    act(() => result.current.sendText("   "));

    expect(session.sendClientContent).toHaveBeenCalledTimes(1);
    expect(result.current.userTranscript).toBe("Jadwal besok?");
  });

  it("mutes the microphone track", async () => {
    const { result } = await started();
    act(() => result.current.toggleMute());
    expect(audio.track.enabled).toBe(false);
    expect(result.current.isMuted).toBe(true);
    expect(result.current.getLevel()).toBe(0);
  });

  it("reports a dropped connection", async () => {
    const { result, session } = await started();
    act(() => session.params.callbacks.onerror!(new Error("socket")));
    expect(result.current).toMatchObject({ status: "error", error: "Koneksi terputus. Silakan coba lagi." });
  });
});

describe("useLibraVoice: tools", () => {
  it("fetches tool results, shows them on screen and sends the summary back to Gemini", async () => {
    const { result, session } = await started();
    const panel = { type: "documents", query: "pecahan", items: [{ id: "class_materi:c1", name: "bab1.pdf" }], openId: null };
    toolReply = { success: true, data: { panel, result: { jumlah_ditemukan: 1 } } };

    await act(async () => session.message({ toolCall: { functionCalls: [{ id: "call-1", name: "show_documents", args: { query: "pecahan" } }] } }));

    await waitFor(() => expect(result.current.panel).toEqual(panel));
    const toolFetch = fetchMock.mock.calls.find(c => c[0] === "/api/libraai-voice/tools")!;
    expect(JSON.parse(toolFetch[1].body)).toEqual({ name: "show_documents", args: { query: "pecahan" } });
    expect(session.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [{ id: "call-1", name: "show_documents", response: { jumlah_ditemukan: 1 } }],
    });

    act(() => result.current.openFile("class_materi:c1"));
    expect(result.current.panel).toMatchObject({ openId: "class_materi:c1" });
  });

  it("shows an error panel and tells Gemini when a tool fails", async () => {
    const { result, session } = await started();
    toolReply = { success: false, error: "boom" };

    await act(async () => session.message({ toolCall: { functionCalls: [{ id: "c", name: "show_grades" }] } }));

    await waitFor(() => expect(result.current.panel).toEqual({ type: "error", tool: "show_grades" }));
    expect(session.sendToolResponse.mock.calls[0][0].functionResponses[0].response).toHaveProperty("error");
  });

  it("closes the panel and rejects unknown tools without calling the server", async () => {
    const { result, session } = await started();
    await act(async () => session.message({ toolCall: { functionCalls: [{ id: "a", name: "show_documents" }] } }));
    await waitFor(() => expect(result.current.panel?.type).toBe("documents"));
    fetchMock.mockClear();

    await act(async () => session.message({ toolCall: { functionCalls: [{ id: "b", name: "close_panel" }, { id: "c", name: "hack" }] } }));

    expect(result.current.panel).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(session.sendToolResponse).toHaveBeenLastCalledWith({
      functionResponses: [
        { id: "b", name: "close_panel", response: { ok: true } },
        { id: "c", name: "hack", response: { error: "Tool tidak dikenal" } },
      ],
    });
  });
});

describe("useLibraVoice: stopping", () => {
  it("closes the session and releases the mic and audio", async () => {
    const { result, session } = await started("Hey Libra");
    act(() => result.current.stopVoiceChat());

    expect(session.close).toHaveBeenCalled();
    expect(audio.track.stop).toHaveBeenCalled();
    expect(audio.contexts.every(c => c.state === "closed")).toBe(true);
    expect(result.current).toMatchObject({ status: "idle", isActive: false, userTranscript: "", aiTranscript: "", wakeDetected: false, panel: null });
  });

  it("closes the session when the component unmounts", async () => {
    const { unmount, session } = await started();
    unmount();
    expect(session.close).toHaveBeenCalled();
    expect(audio.track.stop).toHaveBeenCalled();
  });
});
