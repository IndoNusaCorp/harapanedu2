import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { seedFirestore } from "@/test/fakeFirebase";
import { aiRequest, stubNetwork } from "@/test/ai";
import { POST } from "./route";

const genai = await vi.hoisted(async () => (await import("@/test/ai")).fakeGenAI());
vi.mock("@google/genai", () => genai.module);

const call = (uid?: string) => POST(new NextRequest(aiRequest("http://localhost/api/libraai-voice", { uid, method: "POST" })));

beforeEach(() => {
  genai.apiKeys.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T10:00:00Z"));
  stubNetwork();
  seedFirestore({
    users: {
      t1: { first_name: "Bu", last_name: "Guru", role_id: "2" },
      s1: { first_name: "Ani", role_id: "1", class: 11 },
    },
    classes: { c1: { name: "Fisika XI", teacher_id: "t1" } },
  });
});
afterEach(() => vi.useRealTimers());

describe("POST /api/libraai-voice", () => {
  it("fails clearly when the voice API key is missing", async () => {
    vi.stubEnv("LIBRAAI_VOICE_API_KEY", "");
    const res = await call("s1");
    expect(res.status).toBe(500);
    expect(genai.createToken).not.toHaveBeenCalled();
  });

  it("requires a valid login", async () => {
    expect((await call()).status).toBe(401);
    expect(genai.createToken).not.toHaveBeenCalled();
  });

  it("returns a single-use ephemeral token instead of the API key", async () => {
    const body = await (await call("s1")).json();

    expect(body.data.token).toBe("auth_tokens/ephemeral-123");
    expect(JSON.stringify(body)).not.toContain("test-libra-voice-key");
    expect(genai.apiKeys).toEqual(["test-libra-voice-key"]);
    expect(genai.createToken.mock.calls[0][0].config).toMatchObject({
      uses: 1,
      expireTime: "2026-09-21T10:30:00.000Z",
      newSessionExpireTime: "2026-09-21T10:02:00.000Z",
    });
  });

  it("builds the student's instruction with their data, tone and tools", async () => {
    const { data } = await (await call("s1")).json();

    expect(data.systemInstruction).toContain("Fisika XI");
    expect(data.systemInstruction).toContain("relevan dengan remaja"); // SMA tone for class 11
    expect(data.systemInstruction).toContain("Iya, saya di sini!");
    expect(data.tools[0].functionDeclarations.map((d: { name: string }) => d.name)).toEqual(["show_documents", "show_grades", "close_panel"]);
  });

  it("greets teachers as Bapak/Ibu and describes grades as their students'", async () => {
    const { data } = await (await call("t1")).json();

    expect(data.systemInstruction).toContain("Iya, Bapak/Ibu?");
    const showGrades = data.tools[0].functionDeclarations.find((d: { name: string }) => d.name === "show_grades");
    expect(showGrades.description).toContain("nilai siswa");
  });

  it("returns 500 when the token can't be created", async () => {
    genai.createToken.mockRejectedValueOnce(new Error("boom"));
    expect((await call("s1")).status).toBe(500);
  });
});
