import { describe, it, expect, vi, beforeEach } from "vitest";
import * as firestore from "firebase/firestore";
import { buildAiData, publicFiles } from "./dataContext";

type Row = Record<string, unknown> & { id: string };

const DB: Record<string, Row[]> = {
  users: [
    { id: "t1", first_name: "Bu", last_name: "Guru", role_id: "2" },
    { id: "t2", first_name: "Pak", last_name: "Lain", role_id: "2" },
    { id: "s1", first_name: "Ani", role_id: "1", class: 4 },
    { id: "s2", first_name: "Budi", role_id: "1", class: 4 },
  ],
  classes: [
    { id: "c1", name: "Matematika 4A", teacher_id: "t1", materi_url: "https://x/m.pdf", materi_name: "bab1.pdf" },
    { id: "c2", name: "IPA 4B", teacher_id: "t2" },
  ],
  assignments: [
    { id: "a1", title: "PR Pecahan", class_id: "c1", teacher_id: "t1", due_date: "2026-10-01" },
    { id: "a2", title: "PR Tumbuhan", class_id: "c2", teacher_id: "t2", due_date: "2026-10-02" },
  ],
  assignment_submissions: [
    { id: "a1_s1", assignment_id: "a1", student_id: "s1", status: "submitted", file_url: "https://x/ani.pdf", file_name: "ani.pdf" },
    { id: "a1_s2", assignment_id: "a1", student_id: "s2", status: "submitted", file_url: "https://x/budi.pdf", file_name: "budi.pdf" },
    { id: "a2_s1", assignment_id: "a2", student_id: "s1", status: "submitted", file_url: "https://x/ani2.pdf", file_name: "ani2.pdf" },
  ],
  grades: [
    { id: "g1", student_id: "s1", assignment_id: "a1", score: 90, class_id: "c1" },
    { id: "g2", student_id: "s2", assignment_id: "a1", score: 55, class_id: "c1" },
  ],
  attendances: [],
  meetings: [],
  calendar_events: [],
};

beforeEach(() => {
  vi.mocked(firestore.collection).mockImplementation(((_db: unknown, name: string) => ({ name })) as never);
  vi.mocked(firestore.where).mockImplementation(((field: string, _op: string, value: unknown) => ({ field, value })) as never);
  vi.mocked(firestore.query).mockImplementation(((col: { name: string }, filter: { field: string; value: unknown }) => ({ ...col, filter })) as never);
  vi.mocked(firestore.getDocs).mockImplementation((async (q: { name: string; filter?: { field: string; value: unknown } }) => {
    const rows = (DB[q.name] || []).filter(r => !q.filter || r[q.filter.field] === q.filter.value);
    return { docs: rows.map(({ id, ...data }) => ({ id, data: () => data })) };
  }) as never);
});

describe("buildAiData", () => {
  it("gives a student only their own grades, submissions, and files", async () => {
    const data = await buildAiData({ uid: "s1", role: "student", classLevel: 4, name: "Ani" });
    const text = JSON.stringify(data.context);

    expect(text).toContain("90");
    expect(text).not.toContain("55");
    expect(text).not.toContain("Budi");
    expect(data.files.map(f => f.id)).toEqual(expect.arrayContaining(["class_materi:c1", "submission:a1_s1", "submission:a2_s1"]));
    expect(data.files.some(f => f.id === "submission:a1_s2")).toBe(false);
    expect(data.submissions).toEqual([]);
  });

  it("gives a teacher only submissions for their own assignments", async () => {
    const data = await buildAiData({ uid: "t1", role: "teacher", classLevel: 0, name: "Bu Guru" });

    expect(data.submissions.map(s => s.submission_id).sort()).toEqual(["a1_s1", "a1_s2"]);
    expect(data.submissions.every(s => s.already_graded)).toBe(true);
    expect(JSON.stringify(data.context)).not.toContain("PR Tumbuhan");
    expect(data.files.some(f => f.id === "submission:a2_s1")).toBe(false);
  });

  it("strips download URLs from files sent to the browser", async () => {
    const data = await buildAiData({ uid: "t1", role: "teacher", classLevel: 0, name: "Bu Guru" });
    expect(publicFiles(data.files).every(f => !("url" in f))).toBe(true);
  });
});
