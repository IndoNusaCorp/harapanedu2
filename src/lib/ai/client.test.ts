import { describe, it, expect, vi, beforeEach } from "vitest";
import { signInAs } from "@/test/fakeFirebase";
import { aiFetch } from "./client";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
});

const sentHeaders = () => (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;

describe("aiFetch", () => {
  it("sends the logged-in user's Firebase ID token", async () => {
    signInAs("s1");
    await aiFetch("/api/LibraAI", { method: "POST", body: "{}" });

    expect(fetchMock).toHaveBeenCalledWith("/api/LibraAI", expect.objectContaining({ method: "POST", body: "{}" }));
    expect(sentHeaders()).toEqual({ "Content-Type": "application/json", Authorization: "Bearer token-s1" });
  });

  it("sends no Authorization header when logged out", async () => {
    await aiFetch("/api/LibraAI");
    expect(sentHeaders()).toEqual({ "Content-Type": "application/json" });
  });

  it("lets the caller override headers", async () => {
    signInAs("s1");
    await aiFetch("/api/x", { headers: { "Content-Type": "text/plain" } });
    expect(sentHeaders()["Content-Type"]).toBe("text/plain");
  });
});
