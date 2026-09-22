import { vi } from "vitest";

// Helpers for the AI API routes: a fake network (Google Identity Toolkit + Storage downloads)
// and a recording stand-in for @google/genai.

export interface FakeFile {
  body: string | Uint8Array;
  type?: string;
}

/**
 * Stub global fetch. ID tokens look like "token-<uid>" (what the fake auth hands out);
 * `files` maps download URLs to file contents. Returns the fetch mock.
 */
export function stubNetwork(files: Record<string, FakeFile> = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://identitytoolkit.googleapis.com/v1/accounts:lookup")) {
      const { idToken } = JSON.parse(String(init?.body || "{}"));
      const uid = /^token-(.+)$/.exec(idToken || "")?.[1];
      if (!uid) return Response.json({ error: { message: "INVALID_ID_TOKEN" } }, { status: 400 });
      return Response.json({ users: [{ localId: uid, email: `${uid}@sekolah.test` }] });
    }
    const file = files[url];
    if (!file) return new Response("not found", { status: 404 });
    const body = typeof file.body === "string" ? new TextEncoder().encode(file.body) : file.body;
    return new Response(body as BodyInit, { headers: { "content-type": file.type || "application/octet-stream", "content-length": String(body.byteLength) } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Download URLs that were fetched (excluding the token check). */
export const downloadedUrls = (fetchMock: ReturnType<typeof stubNetwork>) =>
  fetchMock.mock.calls.map(c => String(c[0])).filter(u => !u.includes("identitytoolkit"));

export function aiRequest(url: string, { uid, body, method = body ? "POST" : "GET" }: { uid?: string; body?: unknown; method?: string } = {}) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(uid ? { Authorization: `Bearer token-${uid}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Shared state for the fake @google/genai module; create it with vi.hoisted(fakeGenAI).
 *  generateContent/createToken are reset by `mockReset`; clear `apiKeys` in beforeEach. */
export function fakeGenAI() {
  const generateContent = vi.fn(async (_req: any) => ({ text: "jawaban AI" }));
  const createToken = vi.fn(async (_req: any) => ({ name: "auth_tokens/ephemeral-123" }));
  const apiKeys: (string | undefined)[] = [];
  class GoogleGenAI {
    models = { generateContent };
    authTokens = { create: createToken };
    constructor(opts: { apiKey?: string }) {
      apiKeys.push(opts.apiKey);
    }
  }
  return { generateContent, createToken, apiKeys, module: { GoogleGenAI } };
}
