import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { seedFirestore } from "@/test/fakeFirebase";
import { aiRequest, stubNetwork } from "@/test/ai";
import { POST } from "./route";

const call = (uid: string | undefined, body: unknown) =>
  POST(new NextRequest(aiRequest("http://localhost/api/libraai-voice/tools", { uid, body })));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  stubNetwork();
  seedFirestore({
    users: {
      t1: { first_name: "Bu", last_name: "Guru", role_id: "2" },
      s1: { first_name: "Ani", role_id: "1", class: 4 },
      s2: { first_name: "Budi", role_id: "1", class: 4 },
    },
    classes: {
      c1: { name: "Matematika 4A", teacher_id: "t1", materi_url: "https://x/m.pdf", materi_name: "bab1-pecahan.pdf" },
      c2: { name: "IPA 4A", teacher_id: "t1", materi_url: "https://x/i.pdf", materi_name: "tumbuhan.pdf" },
    },
    assignments: { a1: { title: "PR Pecahan", course_name: "Matematika", class_id: "c1", teacher_id: "t1" } },
    assignment_submissions: {
      a1_s1: { assignment_id: "a1", student_id: "s1", status: "submitted", file_url: "https://x/ani.pdf", file_name: "ani.pdf" },
      a1_s2: { assignment_id: "a1", student_id: "s2", status: "submitted", file_url: "https://x/budi.pdf", file_name: "budi.pdf" },
    },
    grades: {
      g1: { student_id: "s1", assignment_id: "a1", course_name: "Matematika", score: 90, created_at: "2026-09-10" },
      g2: { student_id: "s2", assignment_id: "a1", course_name: "Matematika", score: 60, created_at: "2026-09-11" },
    },
  });
});

describe("POST /api/libraai-voice/tools", () => {
  it("requires a valid login", async () => {
    expect((await call(undefined, { name: "show_documents" })).status).toBe(401);
  });

  it("rejects unknown tools", async () => {
    expect((await call("s1", { name: "delete_everything" })).status).toBe(400);
  });

  it("shows matching documents and opens the first one when asked", async () => {
    const { data } = await (await call("s1", { name: "show_documents", args: { query: "pecahan", open: true } })).json();

    // The class material and the student's own answer for "PR Pecahan" both match
    expect(data.panel.items.map((f: { id: string }) => f.id)).toEqual(["class_materi:c1", "submission:a1_s1"]);
    expect(data.panel.openId).toBe("class_materi:c1");
    expect(data.result).toMatchObject({ jumlah_ditemukan: 2, dibuka: "bab1-pecahan.pdf" });
  });

  it("never shows a student another student's answer file", async () => {
    const { data } = await (await call("s1", { name: "show_documents", args: { kind: "jawaban" } })).json();
    expect(data.panel.items.map((f: { name: string }) => f.name)).toEqual(["ani.pdf"]);
  });

  it("tells the model when nothing matches", async () => {
    const { data } = await (await call("s1", { name: "show_documents", args: { query: "sejarah" } })).json();
    expect(data.panel.items).toEqual([]);
    expect(data.panel.openId).toBeNull();
    expect(data.result.catatan).toContain("Tidak ada file");
  });

  it("shows a student only their own grades with stats", async () => {
    const { data } = await (await call("s1", { name: "show_grades" })).json();

    expect(data.panel).toMatchObject({ type: "grades", scope: "student" });
    expect(data.panel.items).toEqual([expect.objectContaining({ assignment: "PR Pecahan", score: 90 })]);
    expect(data.result).toMatchObject({ jumlah: 1, rata_rata: 90, di_bawah_70: 0 });
    expect(data.result.nilai[0]).not.toHaveProperty("siswa");
  });

  it("shows a teacher their students' grades, filterable by student name", async () => {
    const all = (await (await call("t1", { name: "show_grades" })).json()).data;
    expect(all.panel.scope).toBe("teacher");
    expect(all.result).toMatchObject({ jumlah: 2, rata_rata: 75, terendah: 60, di_bawah_70: 1 });

    const budi = (await (await call("t1", { name: "show_grades", args: { query: "nilai Budi" } })).json()).data;
    expect(budi.result.nilai).toEqual([{ siswa: "Budi", tugas: "PR Pecahan", mapel: "Matematika", nilai: 60 }]);
  });
});
