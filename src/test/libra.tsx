import React from "react";
import { vi } from "vitest";
import { LibraVoiceProvider } from "@/context/LibraVoiceContext";
import { installFakeAudio } from "./voice";

// Network + audio for LibraAI pages: chat replies, the file list, and a voice session token.
export function stubLibraBackend(reply = "Halo, aku LibraAI!") {
  const audio = installFakeAudio();
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/libraai-voice") {
      return Response.json({ success: true, data: { token: "t", model: "m", systemInstruction: "s", tools: [] } });
    }
    if (init?.method === "POST") return Response.json({ success: true, data: { text: reply } });
    return Response.json({ success: true, data: { role: "student", files: [] } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, audio };
}

export const withVoice = (ui: React.ReactElement, basePath: string) => <LibraVoiceProvider basePath={basePath}>{ui}</LibraVoiceProvider>;
