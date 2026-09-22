import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { seedFirestore, seedStorageFile } from "@/test/fakeFirebase";
import { aiRequest, downloadedUrls, stubNetwork } from "@/test/ai";
import { GET, POST } from "./route";

const genai = await vi.hoisted(async () => (await import("@/test/ai")).fakeGenAI());
vi.mock("@google/genai", () => genai.module);

const MATERI = seedStorageFile("class_materi/bab1.txt");
const BUDI = seedStorageFile("submissions/budi.txt");
let fetchMock: ReturnType<typeof stubNetwork>;

const call = (handler: (req: NextRequest) => Promise<Response>, opts: Parameters<typeof aiRequest>[1]) =>
  handler(new NextRequest(aiRequest("http://localhost/api/LibraAI", opts)));
const lastRequest = () => genai.generateContent.mock.calls.at(-1)![0];

beforeEach(() => {
  genai.apiKeys.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock = stubNetwork({
    [MATERI]: { body: "Pecahan adalah bagian dari keseluruhan.", type: "text/plain" },
    [BUDI]: { body: "jawaban budi", type: "text/plain" },
  });
  seedFirestore({
    users: {
      s1: { first_name: "Ani", role_id: "1", class: "Kelas 4 SD" },
      s2: { first_name: "Budi", role_id: "1", class: 4 },
      t1: { first_name: "Bu", last_name: "Guru", role_id: "2" },
    },
    classes: { c1: { name: "Matematika 4A", teacher_id: "t1", materi_url: MATERI, materi_name: "bab1.txt" } },
    assignments: { a1: { title: "PR Pecahan", class_id: "c1", teacher_id: "t1" } },
    assignment_submissions: { a1_s2: { assignment_id: "a1", student_id: "s2", status: "submitted", file_url: BUDI, file_name: "budi.txt" } },
  });
});

describe("GET /api/LibraAI", () => {
  it("requires a valid login", async () => {
    const res = await call(GET, {});
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it("lists the files the user may attach, without download URLs", async () => {
    const res = await call(GET, { uid: "s1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { role: "student", files: [{ id: "class_materi:c1", name: "bab1.txt", kind: "class_materi", label: "Matematika 4A" }] },
    });
  });
});

describe("POST /api/LibraAI", () => {
  it("rejects an empty message", async () => {
    const res = await call(POST, { uid: "s1", body: { message: "   " } });
    expect(res.status).toBe(400);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("answers with the student's own role and tone, ignoring a role claimed in the body", async () => {
    const res = await call(POST, { uid: "s1", body: { message: "Halo", role: "teacher", locale: "en" } });

    expect(await res.json()).toEqual({ success: true, action: "chat", data: { text: "jawaban AI", files: [] } });
    expect(genai.apiKeys).toContain("test-libra-key");
    const { systemInstruction } = lastRequest().config;
    expect(systemInstruction).toContain("teman belajar untuk SISWA");
    expect(systemInstruction).toContain("Ceria, sederhana"); // SD tone for "Kelas 4 SD"
    expect(systemInstruction).not.toContain("Bapak/Ibu");
    expect(systemInstruction).toContain("ALWAYS answer in English.");
  });

  it("only reads attachments the user is allowed to see", async () => {
    const res = await call(POST, { uid: "s1", body: { message: "Rangkum", fileIds: ["class_materi:c1", "submission:a1_s2"] } });

    expect((await res.json()).data.files).toEqual(["bab1.txt"]);
    expect(downloadedUrls(fetchMock)).toEqual([MATERI]);
    const parts = lastRequest().contents.at(-1).parts;
    expect(parts).toEqual([
      { text: '--- FILE: "bab1.txt" (Matematika 4A) ---' },
      { text: "Pecahan adalah bagian dari keseluruhan." },
      { text: "Rangkum" },
    ]);
  });

  it("sends at most the last 20 non-empty history messages", async () => {
    const history = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 ? "model" : "user", content: `pesan ${i}` }));
    history[22].content = "  ";
    await call(POST, { uid: "s1", body: { message: "lanjut", history } });

    const contents = lastRequest().contents;
    expect(contents).toHaveLength(20); // 19 kept + the new message
    expect(contents[0]).toEqual({ role: "model", parts: [{ text: "pesan 5" }] });
    expect(contents.some((c: { parts: { text: string }[] }) => c.parts[0].text === "  ")).toBe(false);
  });

  it("returns 500 without leaking details when Gemini fails", async () => {
    genai.generateContent.mockRejectedValueOnce(new Error("quota exceeded"));
    const res = await call(POST, { uid: "s1", body: { message: "Halo" } });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("quota");
  });
});
