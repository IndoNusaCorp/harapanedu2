import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getFirestoreData,
  getFirestoreDoc,
  seedFirestore,
  seedStorageFile,
  signInAs,
  storageFileExists,
} from "@/test/fakeFirebase";
import {
  applyClassWorkStats,
  applyStudentProgress,
  applyStudentStatus,
  createClass,
  createGrade,
  deleteClass,
  deleteGrade,
  deleteMeeting,
  getAssignmentSubmissions,
  getStudentGPAs,
  getStudentList,
  getUserProfile,
  markNotificationsRead,
  startAssignment,
  submitAssignment,
  TakeAttandance,
  updateAssignment,
  updateUserProfile,
  uploadClassMateri,
} from "./api";
import type { Assignment, AssignmentSubmission, ClassData } from "./types";

const notifications = () => Object.values(getFirestoreData("notifications"));

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("classes", () => {
  it("creates a class owned by the teacher and notifies students", async () => {
    signInAs("t1");
    const created = await createClass({ name: "Matematika 4A", course_name: "Matematika" });

    expect(created?.id).toBeTruthy();
    expect(getFirestoreDoc(`classes/${created!.id}`)).toMatchObject({ name: "Matematika 4A", teacher_id: "t1" });
    expect(notifications()).toEqual([
      expect.objectContaining({ type: "class", title: "Matematika 4A", ref_id: created!.id, audience: "student", created_by: "t1" }),
    ]);
    expect(getFirestoreData("calendar_events")).toEqual({});
    expect(getFirestoreData("meetings")).toEqual({});
  });

  it("puts a scheduled class on the calendar and in meetings without a second notification", async () => {
    signInAs("t1");
    const created = await createClass({ name: "IPA", course_name: "IPA", schedule: "2026-10-05T09:30", room: "R1" });

    expect(Object.values(getFirestoreData("calendar_events"))).toEqual([
      expect.objectContaining({ title: "IPA", event_date: "2026-10-05", event_time: "09:30", location: "R1", event_type: "class", class_id: created!.id }),
    ]);
    expect(Object.values(getFirestoreData("meetings"))).toEqual([
      expect.objectContaining({ title: "IPA", time: "5 Oct 2026, 09:30", status: "upcoming", class_id: created!.id }),
    ]);
    expect(notifications().map(n => n.type)).toEqual(["class"]);
  });

  it("deletes a class with everything that belongs to it, and nothing else", async () => {
    const materi = seedStorageFile("class_materi/bab1.pdf");
    const soal = seedStorageFile("assignment_materi/soal.pdf");
    const jawaban = seedStorageFile("submissions/ani.pdf");
    const bukti = seedStorageFile("attendance_proofs/sakit.jpg");
    seedFirestore({
      classes: { c1: { name: "A", materi_url: materi }, c2: { name: "B" } },
      assignments: { a1: { class_id: "c1", materi_url: soal }, a2: { class_id: "c2" } },
      assignment_submissions: { a1_s1: { assignment_id: "a1", file_url: jawaban }, a2_s1: { assignment_id: "a2" } },
      grades: { g1: { assignment_id: "a1", class_id: "c1" }, g2: { assignment_id: "a2", class_id: "c2" } },
      calendar_events: { e1: { class_id: "c1" }, e2: { class_id: "c2" } },
      meetings: { m1: { class_id: "c1" }, m2: { class_id: "c2" } },
      "meetings/m1/messages": { x: { text: "halo" } },
      "meetings/m1/reactions": { y: { emoji: "👍" } },
      enrolled_classes: { en1: { class_id: "c1" }, en2: { class_id: "c2" } },
      attendances: { at1: { class_id: "c1", proof_url: bukti }, at2: { class_id: "c2" } },
      notifications: { n1: { class_id: "c1" }, n2: { ref_id: "a1" }, n3: { ref_id: "m1" }, n4: { class_id: "c2" } },
    });

    expect(await deleteClass("c1")).toBe(true);

    expect(Object.keys(getFirestoreData("classes"))).toEqual(["c2"]);
    expect(Object.keys(getFirestoreData("assignments"))).toEqual(["a2"]);
    expect(Object.keys(getFirestoreData("assignment_submissions"))).toEqual(["a2_s1"]);
    expect(Object.keys(getFirestoreData("grades"))).toEqual(["g2"]);
    expect(Object.keys(getFirestoreData("calendar_events"))).toEqual(["e2"]);
    expect(Object.keys(getFirestoreData("meetings"))).toEqual(["m2"]);
    expect(getFirestoreData("meetings/m1/messages")).toEqual({});
    expect(getFirestoreData("meetings/m1/reactions")).toEqual({});
    expect(Object.keys(getFirestoreData("enrolled_classes"))).toEqual(["en2"]);
    expect(Object.keys(getFirestoreData("attendances"))).toEqual(["at2"]);
    expect(Object.keys(getFirestoreData("notifications"))).toEqual(["n4"]);
    for (const path of ["class_materi/bab1.pdf", "assignment_materi/soal.pdf", "submissions/ani.pdf", "attendance_proofs/sakit.jpg"]) {
      expect(storageFileExists(path), path).toBe(false);
    }
  });

  it("still deletes the class when a Storage file is already gone", async () => {
    seedFirestore({ classes: { c1: { materi_url: "https://firebasestorage.googleapis.com/v0/b/x/o/missing.pdf" } } });
    expect(await deleteClass("c1")).toBe(true);
    expect(getFirestoreData("classes")).toEqual({});
  });
});

describe("assignments and submissions", () => {
  it("fails (instead of creating a document) when updating an assignment that doesn't exist", async () => {
    expect(await updateAssignment("missing", { title: "x" })).toBe(false);
    expect(getFirestoreData("assignments")).toEqual({});
    expect(consoleError).toHaveBeenCalled();
  });

  it("marks an assignment as started once, without overwriting a submission", async () => {
    signInAs("s1");
    expect(await startAssignment("a1")).toBe(true);
    expect(getFirestoreDoc("assignment_submissions/a1_s1")).toMatchObject({ assignment_id: "a1", student_id: "s1", status: "started" });

    await submitAssignment("a1", "ani.pdf", "https://x/ani.pdf");
    await startAssignment("a1");
    expect(getFirestoreDoc("assignment_submissions/a1_s1")?.status).toBe("submitted");
  });

  it("keeps started_at when the student submits", async () => {
    signInAs("s1");
    await startAssignment("a1");
    const startedAt = getFirestoreDoc("assignment_submissions/a1_s1")?.started_at;

    expect(await submitAssignment("a1", "ani.pdf", "https://x/ani.pdf")).toBe(true);
    expect(getFirestoreDoc("assignment_submissions/a1_s1")).toMatchObject({
      status: "submitted",
      file_name: "ani.pdf",
      file_url: "https://x/ani.pdf",
      started_at: startedAt,
    });
  });

  it("refuses to start or submit when nobody is logged in", async () => {
    expect(await startAssignment("a1")).toBe(false);
    expect(await submitAssignment("a1")).toBe(false);
    expect(getFirestoreData("assignment_submissions")).toEqual({});
  });

  it("adds the student's name to each submission", async () => {
    seedFirestore({
      users: { s1: { first_name: "Ani", last_name: "Putri" }, s2: { name: "Budi" } },
      assignment_submissions: {
        a1_s1: { assignment_id: "a1", student_id: "s1" },
        a1_s2: { assignment_id: "a1", student_id: "s2" },
        a1_s3: { assignment_id: "a1", student_id: "ghost" },
        a2_s1: { assignment_id: "a2", student_id: "s1" },
      },
    });
    const subs = await getAssignmentSubmissions("a1");
    expect(subs.map(s => [s.id, s.student_name])).toEqual([
      ["a1_s1", "Ani Putri"],
      ["a1_s2", "Budi"],
      ["a1_s3", "Unknown Student"],
    ]);
  });

  it("shows each student their own status instead of the assignment's", () => {
    const assignments = [{ id: "a1", status: "active" }, { id: "a2", status: "active" }] as Assignment[];
    const subs = [{ assignment_id: "a2", status: "graded" }] as AssignmentSubmission[];
    expect(applyStudentStatus(assignments, subs).map(a => a.status)).toEqual(["active", "graded"]);
  });
});

describe("grades", () => {
  beforeEach(() => {
    seedFirestore({
      users: { s1: { first_name: "Ani", last_name: "Putri" } },
      assignment_submissions: { a1_s1: { assignment_id: "a1", student_id: "s1", status: "submitted" } },
    });
  });

  it("grading marks the submission graded and notifies both teacher and student", async () => {
    signInAs("t1");
    const grade = await createGrade({ course_name: "Matematika", student_id: "s1", assignment_id: "a1", class_id: "c1", score: 88 });

    expect(getFirestoreDoc(`grades/${grade!.id}`)).toMatchObject({ score: 88, graded_by: "t1" });
    expect(getFirestoreDoc("assignment_submissions/a1_s1")?.status).toBe("graded");
    expect(notifications()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "grade_given", audience: "teacher", recipient_id: "t1", student_name: "Ani Putri", score: 88 }),
      expect.objectContaining({ type: "grade_received", audience: "student", recipient_id: "s1", assignment_id: "a1" }),
    ]));
  });

  it("does not mark work graded that the student only started", async () => {
    seedFirestore({ assignment_submissions: { a2_s1: { assignment_id: "a2", student_id: "s1", status: "started" } } });
    signInAs("t1");
    await createGrade({ course_name: "IPA", student_id: "s1", assignment_id: "a2", score: 70 });
    expect(getFirestoreDoc("assignment_submissions/a2_s1")?.status).toBe("started");
  });

  it("deleting a grade removes its notifications and puts the work back to 'submitted'", async () => {
    signInAs("t1");
    const grade = await createGrade({ course_name: "Matematika", student_id: "s1", assignment_id: "a1", score: 88 });
    seedFirestore({ notifications: { other: { ref_id: "something-else" } } });

    expect(await deleteGrade(grade!.id)).toBe(true);
    expect(getFirestoreData("grades")).toEqual({});
    expect(Object.keys(getFirestoreData("notifications"))).toEqual(["other"]);
    expect(getFirestoreDoc("assignment_submissions/a1_s1")?.status).toBe("submitted");
  });

  it("computes a credit-weighted GPA per student", async () => {
    seedFirestore({
      users: { s1: { first_name: "Ani" }, s2: { name: "Budi" } },
      grades: {
        g1: { student_id: "s1", score: 95, credits: 3 }, // 4.0
        g2: { student_id: "s1", score: 72, credits: 1 }, // 2.7
        g3: { student_id: "s2", score: 50, credits: 2 }, // 0.0
      },
    });
    const gpas = await getStudentGPAs();
    expect(gpas).toEqual(expect.arrayContaining([
      { id: "s1", name: "Ani", gpa: "3.67", totalCredits: 4, avgScore: 83.5 },
      { id: "s2", name: "Budi", gpa: "0.00", totalCredits: 2, avgScore: 50 },
    ]));
  });
});

describe("attendance", () => {
  beforeEach(() => {
    seedFirestore({ classes: { c1: { name: "Matematika 4A", teacher_id: "t1", attendance: 2 } } });
    signInAs("s1");
  });

  it("counts the attendance on the class and tells the teacher the student is present", async () => {
    expect(await TakeAttandance({ class_id: "c1", student_id: "s1", first_name: "Ani", last_name: "Putri", status: "Late" })).toBe(true);

    expect(getFirestoreDoc("classes/c1")).toMatchObject({ attendance: 2, late: 1, course_progress: 1 });
    expect(notifications()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "attendance_taken", audience: "student", recipient_id: "s1", title: "Matematika 4A" }),
      expect.objectContaining({ type: "attendance_present", audience: "teacher", recipient_id: "t1", student_name: "Ani Putri" }),
    ]));
    expect(notifications().find(n => n.type === "attendance_present")).not.toHaveProperty("reason");
  });

  it("sends the teacher the reason and proof for an absence", async () => {
    await TakeAttandance({
      class_id: "c1", student_id: "s1", first_name: "Ani", last_name: "Putri",
      status: "ExcusedAbsen", reason: "  sakit  ", proof_url: "https://x/surat.jpg",
    });

    expect(getFirestoreDoc("classes/c1")).toMatchObject({ excused_absence: 1, attendance: 2 });
    expect(notifications().find(n => n.audience === "teacher")).toMatchObject({
      type: "attendance_absent", reason: "sakit", proof_url: "https://x/surat.jpg", attendance_status: "ExcusedAbsen",
    });
  });

  it("fails for a class that doesn't exist", async () => {
    expect(await TakeAttandance({ class_id: "missing", student_id: "s1", first_name: "A", last_name: "B", status: "Attended" })).toBe(false);
  });
});

describe("class statistics", () => {
  it("counts ungraded submissions, feedback and distinct present students per class", async () => {
    seedFirestore({
      assignments: { a1: { class_id: "c1", due_date: "2026-10-01" }, a2: { class_id: "c2", due_date: "2026-10-02" } },
      assignment_submissions: {
        a1_s1: { assignment_id: "a1", student_id: "s1", status: "submitted" },
        a1_s2: { assignment_id: "a1", student_id: "s2", status: "submitted" }, // already has a grade
        a1_s3: { assignment_id: "a1", student_id: "s3", status: "started" },
        a2_s1: { assignment_id: "a2", student_id: "s1", status: "submitted" },
      },
      grades: {
        g1: { assignment_id: "a1", student_id: "s2", class_id: "c1", feedback: "Bagus", created_at: "2026-09-01" },
        g2: { assignment_id: "a2", student_id: "s9", feedback: "  ", created_at: "2026-09-02" },
      },
      attendances: {
        x1: { class_id: "c1", student_id: "s1", status: "Attended" },
        x2: { class_id: "c1", student_id: "s1", status: "Late" },
        x3: { class_id: "c1", student_id: "s2", status: "Absence" },
        x4: { class_id: "c2", student_id: "s3", status: "Late" },
      },
    });

    const stats = await applyClassWorkStats([{ id: "c1" }, { id: "c2" }, { id: "c3" }] as ClassData[]);
    expect(stats.map(c => [c.id, c.needs_grading, c.feedback_count, c.student_count])).toEqual([
      ["c1", 1, 1, 1],
      ["c2", 1, 0, 1],
      ["c3", 0, 0, 0],
    ]);
  });
});

describe("student progress", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 21, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("is 50% for attending plus a share of 50% for uploaded assignments", async () => {
    seedFirestore({
      assignments: {
        a1: { class_id: "c1", due_date: "2026-10-01" },
        a2: { class_id: "c1", due_date: "2026-10-02" },
        a3: { class_id: "c2", due_date: "2026-10-03" },
      },
      assignment_submissions: {
        a1_s1: { assignment_id: "a1", student_id: "s1", status: "graded" },
        a2_s1: { assignment_id: "a2", student_id: "s1", status: "started" },
        a3_s1: { assignment_id: "a3", student_id: "s1", status: "submitted" },
      },
      attendances: {
        x1: { class_id: "c1", student_id: "s1", status: "Attended", created_at: new Date(2026, 8, 21, 8).toISOString() },
        x2: { class_id: "c2", student_id: "s1", status: "Absence", created_at: new Date(2026, 8, 20).toISOString() },
        x3: { class_id: "c3", student_id: "s1", status: "Late", created_at: new Date(2026, 8, 1).toISOString() },
        other: { class_id: "c2", student_id: "s2", status: "Attended" },
      },
    });

    const result = await applyStudentProgress([{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }] as ClassData[], "s1");
    expect(result.map(c => [c.id, c.course_progress, c.attended_today])).toEqual([
      ["c1", 75, true], // hadir + 1 of 2 uploaded
      ["c2", 50, false], // absent, but its only assignment is uploaded
      ["c3", 100, false], // attended a class without assignments
      ["c4", 0, false],
    ]);
  });
});

describe("student list", () => {
  it("lists users with role_id 1", async () => {
    seedFirestore({ users: { s1: { role_id: "1" }, t1: { role_id: "2" } } });
    expect((await getStudentList()).map(s => s.id)).toEqual(["s1"]);
  });

  it("falls back to role 'student' for older accounts", async () => {
    seedFirestore({ users: { s1: { role: "student" }, t1: { role: "teacher" } } });
    expect((await getStudentList()).map(s => s.id)).toEqual(["s1"]);
  });
});

describe("meetings", () => {
  it("deletes a meeting with its chat, reactions and notifications", async () => {
    seedFirestore({
      meetings: { m1: { title: "Live" }, m2: { title: "Other" } },
      "meetings/m1/messages": { a: { text: "hi" }, b: { text: "yo" } },
      "meetings/m1/reactions": { r: { emoji: "👏" } },
      "meetings/m2/messages": { c: { text: "keep" } },
      notifications: { n1: { ref_id: "m1" }, n2: { ref_id: "m2" } },
    });

    expect(await deleteMeeting("m1")).toBe(true);
    expect(Object.keys(getFirestoreData("meetings"))).toEqual(["m2"]);
    expect(getFirestoreData("meetings/m1/messages")).toEqual({});
    expect(getFirestoreData("meetings/m1/reactions")).toEqual({});
    expect(Object.keys(getFirestoreData("meetings/m2/messages"))).toEqual(["c"]);
    expect(Object.keys(getFirestoreData("notifications"))).toEqual(["n2"]);
  });
});

describe("user profile", () => {
  it("returns nothing and writes nothing when logged out", async () => {
    expect(await getUserProfile()).toBeNull();
    expect(await updateUserProfile({ first_name: "X" })).toBe(false);
  });

  it("reads and updates the logged-in user's own profile", async () => {
    seedFirestore({ users: { s1: { first_name: "Ani" }, s2: { first_name: "Budi" } } });
    signInAs("s1");

    expect(await getUserProfile()).toMatchObject({ first_name: "Ani" });
    expect(await updateUserProfile({ last_name: "Putri" })).toBe(true);
    expect(await markNotificationsRead()).toBe(true);
    expect(getFirestoreDoc("users/s1")).toMatchObject({ first_name: "Ani", last_name: "Putri", notifications_read_at: expect.any(String) });
    expect(getFirestoreDoc("users/s2")).toEqual({ first_name: "Budi" });
  });
});

describe("uploads", () => {
  it("uploads class material and returns its download URL", async () => {
    const url = await uploadClassMateri(new File(["isi"], "bab1.pdf", { type: "application/pdf" }));
    expect(url).toMatch(/^https:\/\/firebasestorage\.googleapis\.com\/.+class_materi%2F\d+_bab1\.pdf\?alt=media$/);
  });
});
