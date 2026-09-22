import { seedFirestore, seedStorageFile, signInAs } from "./fakeFirebase";
import { setNavigation } from "./navigation";

// A small school for page tests:
// - t1 Sari Dewi teaches "Matematika 4A" (c1); t2 teaches "IPA 8B" (c2)
// - s1 Ani is in grade 4 (kids mode); s2 Budi is in grade 8 (regular student view)
// - Budi submitted and got a grade for "PR Pecahan"; Ani has only started it

export const TODAY = new Date("2026-09-21T09:00:00+07:00");

export const MATERI_URL = seedStorageFile("class_materi/1_bab1.pdf");
export const ANSWER_URL = seedStorageFile("submissions/1_budi.pdf");

export function seedSchool() {
  seedStorageFile("class_materi/1_bab1.pdf");
  seedStorageFile("submissions/1_budi.pdf");
  seedFirestore({
    users: {
      t1: { first_name: "Sari", last_name: "Dewi", role_id: "2" },
      t2: { first_name: "Pak", last_name: "Joko", role_id: "2" },
      s1: { first_name: "Ani", last_name: "Putri", role_id: "1", class: 4 },
      s2: { first_name: "Budi", last_name: "Santoso", role_id: "1", class: 8 },
    },
    classes: {
      c1: {
        name: "Matematika 4A", course_name: "Matematika", description: "Pecahan dan desimal", teacher_id: "t1",
        schedule: "Senin 08.00", room: "R-1", materi_url: MATERI_URL, materi_name: "bab1.pdf", created_at: "2026-09-01T00:00:00Z",
      },
      c2: { name: "IPA 8B", course_name: "IPA", teacher_id: "t2", created_at: "2026-09-02T00:00:00Z" },
    },
    assignments: {
      a1: {
        title: "PR Pecahan", course_name: "Matematika", description: "Kerjakan soal 1-10", class_id: "c1", teacher_id: "t1",
        status: "active", due_date: "2026-09-30T10:00:00.000Z", created_at: "2026-09-10T00:00:00Z",
      },
      a2: {
        title: "PR Tumbuhan", course_name: "IPA", class_id: "c2", teacher_id: "t2",
        status: "active", due_date: "2026-10-05T10:00:00.000Z", created_at: "2026-09-11T00:00:00Z",
      },
    },
    assignment_submissions: {
      a1_s1: { assignment_id: "a1", student_id: "s1", status: "started", started_at: "2026-09-15T00:00:00Z" },
      a1_s2: {
        assignment_id: "a1", student_id: "s2", status: "graded", file_name: "budi.pdf", file_url: ANSWER_URL,
        submitted_at: "2026-09-16T00:00:00Z",
      },
    },
    grades: {
      g1: {
        student_id: "s2", assignment_id: "a1", class_id: "c1", course_name: "Matematika", score: 88, grade_letter: "B+",
        credits: 3, feedback: "Bagus, pertahankan!", graded_by: "t1", created_at: "2026-09-17T00:00:00Z",
      },
    },
    meetings: {
      m1: { title: "Review Pecahan", time: "Senin, 09.00", status: "upcoming", link: "", teacher_id: "t1", class_id: "c1", created_at: "2026-09-12T00:00:00Z" },
    },
    calendar_events: {
      e1: { title: "Ujian Tengah Semester", event_date: "2026-09-24", event_time: "08.00", event_type: "exam", location: "Aula", created_by: "t1", created_at: "2026-09-05T00:00:00Z" },
    },
  });
}

const PEOPLE = {
  t1: { role: "teacher", path: "pengajar", classLevel: null },
  s1: { role: "student", path: "pelajar", classLevel: 4 },
  s2: { role: "student", path: "pelajar", classLevel: 8 },
} as const;

/** Seed the school and log in as one of its people, at `/id/<role>/<uid><subpath>`. */
export function loginAs(uid: keyof typeof PEOPLE, subpath = "", search = "") {
  seedSchool();
  const person = PEOPLE[uid];
  signInAs(uid);
  setNavigation({ pathname: `/id/${person.path}/${uid}${subpath}`, params: { role: person.path, id: uid }, search });
  return { role: person.role, classLevel: person.classLevel } as { role: "teacher" | "student"; classLevel: number | null };
}
