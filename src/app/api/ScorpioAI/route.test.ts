import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { seedFirestore, seedStorageFile } from "@/test/fakeFirebase";
import { aiRequest, downloadedUrls, stubNetwork } from "@/test/ai";
import { GRADE_MARKER } from "@/lib/ai/tone";
import { GET, POST } from "./route";

const genai = await vi.hoisted(async () => (await import("@/test/ai")).fakeGenAI());
vi.mock("@google/genai", () => genai.module);

const SOAL = seedStorageFile("assignment_materi/soal.txt");
const ANI = seedStorageFile("submissions/ani.txt");
const BUDI = seedStorageFile("submissions/budi.txt");
const LAIN = seedStorageFile("submissions/lain.txt");
let fetchMock: ReturnType<typeof stubNetwork>;

const call = (handler: (req: NextRequest) => Promise<Response>, opts: Parameters<typeof aiRequest>[1]) =>
  handler(new NextRequest(aiRequest("http://localhost/api/ScorpioAI", opts)));
const grade = (uid: string, submissionIds: string[]) => call(POST, { uid, body: { action: "grade", submissionIds } });
const aiReplies = (...replies: object[]) => replies.forEach(r => genai.generateContent.mockResolvedValueOnce({ text: JSON.stringify(r) }));

beforeEach(() => {
  genai.apiKeys.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  fetchMock = stubNetwork({
    [SOAL]: { body: "1 + 1 = ?", type: "text/plain" },
    [ANI]: { body: "2", type: "text/plain" },
    [BUDI]: { body: "", type: "text/plain" },
    [LAIN]: { body: "rahasia", type: "text/plain" },
  });
  seedFirestore({
    users: {
      t1: { first_name: "Bu", last_name: "Guru", role_id: "2" },
      t2: { first_name: "Pak", last_name: "Lain", role_id: "2" },
      s1: { first_name: "Ani", role_id: "1", class: 4 },
      s2: { first_name: "Budi", role_id: "1", class: 4 },
      s3: { first_name: "Citra", role_id: "1", class: 4 },
    },
    classes: { c1: { name: "Matematika 4A", teacher_id: "t1" }, c2: { name: "IPA", teacher_id: "t2" } },
    assignments: {
      a1: { title: "PR Penjumlahan", course_name: "Matematika", class_id: "c1", teacher_id: "t1", materi_url: SOAL, materi_name: "soal.txt" },
      a2: { title: "PR IPA", class_id: "c2", teacher_id: "t2" },
    },
    assignment_submissions: {
      a1_s1: { assignment_id: "a1", student_id: "s1", status: "submitted", file_url: ANI, file_name: "ani.txt", submitted_at: "2026-09-02" },
      a1_s2: { assignment_id: "a1", student_id: "s2", status: "submitted", file_url: BUDI, file_name: "budi.txt", submitted_at: "2026-09-01" },
      a1_s3: { assignment_id: "a1", student_id: "s3", status: "submitted", submitted_at: "2026-09-03" },
      a2_s1: { assignment_id: "a2", student_id: "s1", status: "submitted", file_url: LAIN, file_name: "lain.txt" },
    },
  });
});

describe("GET /api/ScorpioAI", () => {
  it("gives teachers their submitted work without download URLs", async () => {
    const body = await (await call(GET, { uid: "t1" })).json();
    expect(body.data.role).toBe("teacher");
    expect(body.data.submissions.map((s: { submission_id: string }) => s.submission_id)).toEqual(["a1_s3", "a1_s1", "a1_s2"]);
    expect(JSON.stringify(body)).not.toContain("https://");
  });

  it("gives students no submission list", async () => {
    const body = await (await call(GET, { uid: "s1" })).json();
    expect(body.data).toMatchObject({ role: "student", submissions: [] });
  });
});

describe("POST /api/ScorpioAI (chat)", () => {
  it("adds the grade button instruction only for teachers", async () => {
    await call(POST, { uid: "t1", body: { message: "Tampilkan pengumpulan" } });
    expect(genai.generateContent.mock.calls[0][0].config.systemInstruction).toContain(GRADE_MARKER);

    await call(POST, { uid: "s1", body: { message: "Nilaiku berapa?" } });
    expect(genai.generateContent.mock.calls[1][0].config.systemInstruction).not.toContain(GRADE_MARKER);
    expect(genai.apiKeys).toEqual(["test-scorpio-key", "test-scorpio-key"]);
  });
});

describe("POST /api/ScorpioAI (grading)", () => {
  it("is only available to teachers", async () => {
    const res = await grade("s1", ["a1_s1"]);
    expect(res.status).toBe(403);
    expect(genai.generateContent).not.toHaveBeenCalled();
  });

  it("grades the answer against the question file and clamps the score", async () => {
    aiReplies({ score: 104.6, feedback: "Sempurna", readable: true });
    const body = await (await grade("t1", ["a1_s1"])).json();

    expect(body).toEqual({
      success: true,
      action: "grade",
      data: {
        results: [{
          submission_id: "a1_s1", student_id: "s1", student_name: "Ani", assignment_id: "a1",
          assignment_title: "PR Penjumlahan", course_name: "Matematika", class_id: "c1",
          score: 100, grade_letter: "A", feedback: "Sempurna",
        }],
        skipped: [],
      },
    });
    const parts = genai.generateContent.mock.calls[0][0].contents[0].parts.map((p: { text?: string }) => p.text);
    expect(parts).toEqual(expect.arrayContaining(["FILE SOAL:", "1 + 1 = ?", "FILE JAWABAN SISWA:", "2"]));
    expect(genai.generateContent.mock.calls[0][0].config.responseMimeType).toBe("application/json");
  });

  it("skips work the AI can't read and work without a file", async () => {
    aiReplies({ score: 0, feedback: "Kosong", readable: false });
    const body = await (await grade("t1", ["a1_s2", "a1_s3"])).json();

    expect(body.data.results).toEqual([]);
    expect(body.data.skipped.sort()).toEqual(["Budi · PR Penjumlahan", "Citra · PR Penjumlahan"]);
    expect(genai.generateContent).toHaveBeenCalledTimes(1);
  });

  it("skips a submission when the AI reply is not valid JSON", async () => {
    genai.generateContent.mockResolvedValueOnce({ text: "maaf, saya tidak bisa" });
    const body = await (await grade("t1", ["a1_s1"])).json();
    expect(body.data).toEqual({ results: [], skipped: ["Ani · PR Penjumlahan"] });
  });

  it("never grades or downloads another teacher's submissions", async () => {
    const body = await (await grade("t1", ["a2_s1"])).json();
    expect(body.data).toEqual({ results: [], skipped: [] });
    expect(downloadedUrls(fetchMock)).not.toContain(LAIN);
  });
});
