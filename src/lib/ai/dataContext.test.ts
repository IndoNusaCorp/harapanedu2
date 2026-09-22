import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { seedFirestore } from "@/test/fakeFirebase";
import { buildAiData, publicFiles } from "./dataContext";

const student = { uid: "s1", role: "student" as const, classLevel: 4, name: "Ani" };
const teacher = { uid: "t1", role: "teacher" as const, classLevel: 0, name: "Bu Guru" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T08:00:00Z"));
  seedFirestore({
    users: {
      t1: { first_name: "Bu", last_name: "Guru", role_id: "2" },
      t2: { first_name: "Pak", last_name: "Lain", role_id: "2" },
      s1: { first_name: "Ani", role_id: "1", class: 4 },
      s2: { first_name: "Budi", role_id: "1", class: 4 },
    },
    classes: {
      c1: { name: "Matematika 4A", teacher_id: "t1", materi_url: "https://x/m.pdf", materi_name: "bab1.pdf" },
      c2: { name: "IPA 4B", teacher_id: "t2" },
    },
    assignments: {
      a1: { title: "PR Pecahan", class_id: "c1", teacher_id: "t1", due_date: "2026-10-01", materi_url: "https://x/soal.pdf", materi_name: "soal.pdf" },
      a2: { title: "PR Tumbuhan", class_id: "c2", teacher_id: "t2", due_date: "2026-10-02" },
      a3: { title: "PR Belum Dikumpulkan", class_id: "c1", teacher_id: "t1", due_date: "2026-10-03" },
    },
    assignment_submissions: {
      a1_s1: { assignment_id: "a1", student_id: "s1", status: "submitted", file_url: "https://x/ani.pdf", file_name: "ani.pdf", submitted_at: "2026-09-10" },
      a1_s2: { assignment_id: "a1", student_id: "s2", status: "submitted", file_url: "https://x/budi.pdf", file_name: "budi.pdf", submitted_at: "2026-09-11" },
      a2_s1: { assignment_id: "a2", student_id: "s1", status: "submitted", file_url: "https://x/ani2.pdf", file_name: "ani2.pdf" },
      a3_s2: { assignment_id: "a3", student_id: "s2", status: "started" },
    },
    grades: {
      g1: { student_id: "s1", assignment_id: "a1", score: 91, class_id: "c1", created_at: "2026-09-12" },
      g2: { student_id: "s2", assignment_id: "a1", score: 55, class_id: "c1", created_at: "2026-09-13" },
    },
    attendances: {
      at1: { student_id: "s1", class_id: "c1", status: "Attended" },
      at2: { student_id: "s1", class_id: "c1", status: "Late" },
      at3: { student_id: "s2", class_id: "c1", status: "Absence" },
    },
    meetings: {
      m1: { title: "Live Pecahan", teacher_id: "t1", status: "live", created_at: "2026-09-20" },
      m2: { title: "Selesai", teacher_id: "t1", status: "live", isEnded: true, created_at: "2026-09-19" },
    },
    calendar_events: {
      e1: { title: "Ujian", event_date: "2026-09-30", class_id: "c1" },
      e2: { title: "Lewat", event_date: "2026-09-01", class_id: "c1" },
    },
  });
});

afterEach(() => vi.useRealTimers());

describe("buildAiData for a student", () => {
  it("includes only the student's own grades and submissions", async () => {
    const { context } = await buildAiData(student);

    expect(context.nilai_saya).toEqual([
      expect.objectContaining({ tugas: "PR Pecahan", nilai: 91, tanggal: "2026-09-12" }),
    ]);
    expect(JSON.stringify(context)).not.toContain("Budi");
    const tugas = context.tugas as { judul: string; status_saya: string; file_jawaban_saya?: string }[];
    expect(tugas.find(t => t.judul === "PR Pecahan")).toMatchObject({ status_saya: "submitted", file_jawaban_saya: "ani.pdf" });
    expect(tugas.find(t => t.judul === "PR Belum Dikumpulkan")?.status_saya).toBe("belum dikerjakan");
  });

  it("lets the student read class/assignment materials and only their own answer files", async () => {
    const { files, submissions } = await buildAiData(student);

    expect(files.map(f => f.id).sort()).toEqual([
      "assignment_materi:a1",
      "class_materi:c1",
      "submission:a1_s1",
      "submission:a2_s1",
    ]);
    expect(submissions).toEqual([]);
  });

  it("summarizes the student's attendance per class", async () => {
    const { context } = await buildAiData(student);
    expect(context.absensi_saya).toEqual([{ kelas: "Matematika 4A", hadir: 1, terlambat: 1, absen: 0, izin: 0 }]);
  });

  it("lists only upcoming events and marks ended meetings as not live", async () => {
    const { context } = await buildAiData(student);
    expect(context.jadwal_mendatang).toEqual([expect.objectContaining({ judul: "Ujian", tanggal: "2026-09-30" })]);
    expect(context.meeting).toEqual([
      { judul: "Live Pecahan", waktu: undefined, sedang_berlangsung: true },
      { judul: "Selesai", waktu: undefined, sedang_berlangsung: false },
    ]);
  });
});

describe("buildAiData for a teacher", () => {
  it("returns only submitted work for the teacher's own assignments, newest first", async () => {
    const { submissions } = await buildAiData(teacher);

    expect(submissions.map(s => s.submission_id)).toEqual(["a1_s2", "a1_s1"]);
    expect(submissions[0]).toMatchObject({
      student_name: "Budi",
      assignment_title: "PR Pecahan",
      assignment_materi_id: "assignment_materi:a1",
      already_graded: true,
    });
  });

  it("keeps other teachers' classes and assignments out of the context", async () => {
    const { context, files } = await buildAiData(teacher);

    expect((context.kelas_saya as { nama: string }[]).map(c => c.nama)).toEqual(["Matematika 4A"]);
    expect(JSON.stringify(context)).not.toContain("PR Tumbuhan");
    expect(files.some(f => f.id === "submission:a2_s1")).toBe(false);
  });

  it("counts submitted and in-progress work per assignment", async () => {
    const { context } = await buildAiData(teacher);
    const tugas = context.tugas_saya as { judul: string; jumlah_dikumpulkan: number; jumlah_sedang_dikerjakan: number; jumlah_siswa: number }[];

    expect(tugas.find(t => t.judul === "PR Pecahan")).toMatchObject({ jumlah_dikumpulkan: 2, jumlah_sedang_dikerjakan: 0, jumlah_siswa: 2 });
    expect(tugas.find(t => t.judul === "PR Belum Dikumpulkan")).toMatchObject({ jumlah_dikumpulkan: 0, jumlah_sedang_dikerjakan: 1 });
  });

  it("summarizes attendance for each of the teacher's classes", async () => {
    const { context } = await buildAiData(teacher);
    expect(context.absensi_per_kelas).toEqual([{ kelas: "Matematika 4A", hadir: 1, terlambat: 1, absen: 1, izin: 0 }]);
  });
});

describe("publicFiles", () => {
  it("strips download URLs from files sent to the browser", async () => {
    const { files } = await buildAiData(teacher);
    const pub = publicFiles(files);

    expect(pub).toHaveLength(files.length);
    expect(pub.every(f => !("url" in f))).toBe(true);
    expect(pub[0]).toEqual({ id: files[0].id, name: files[0].name, kind: files[0].kind, label: files[0].label });
  });
});
