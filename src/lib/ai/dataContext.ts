import { collection, getDocs, query, where } from "firebase/firestore";
import { connecttofirestore } from "@/lib/firebase";
import type { AiFileRef, AiSubmissionItem } from "@/lib/types";
import { fullName, type AiUser } from "./serverAuth";

// ============================================
// Data Firestore + Storage untuk AI
// ============================================
// Semua jawaban AI hanya boleh bersumber dari data di sini.
// - Siswa: HANYA data miliknya sendiri (nilai, pengumpulan, absensi) + kelas/tugas/jadwal umum.
// - Guru : data kelas & tugas yang dia buat, pengumpulan & nilai siswanya, daftar siswa.

const MAX_ROWS = 60;

type Row = Record<string, any>;

export interface ServerFileRef extends AiFileRef {
  url: string;
}

export interface AiData {
  // Ringkasan data yang dimasukkan ke system prompt
  context: Record<string, unknown>;
  // File Storage yang boleh dibaca AI oleh user ini
  files: ServerFileRef[];
  // Khusus guru: tugas yang sudah dikumpulkan (untuk ScorpioAI menilai)
  submissions: (AiSubmissionItem & { file_url: string | null; assignment_description?: string; assignment_materi_id?: string })[];
}

async function all(koleksi: string): Promise<Row[]> {
  const snap = await getDocs(collection(connecttofirestore, koleksi));
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

async function whereEq(koleksi: string, field: string, value: string): Promise<Row[]> {
  const snap = await getDocs(query(collection(connecttofirestore, koleksi), where(field, "==", value)));
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

const byDateDesc = (field: string) => (a: Row, b: Row) => String(b[field] || "").localeCompare(String(a[field] || ""));
const today = () => new Date().toISOString().slice(0, 10);

function materiFiles(classes: Row[], assignments: Row[]): ServerFileRef[] {
  return [
    ...classes.filter(c => c.materi_url).map(c => ({
      id: `class_materi:${c.id}`,
      name: c.materi_name || "materi",
      url: c.materi_url,
      kind: "class_materi" as const,
      label: c.name,
    })),
    ...assignments.filter(a => a.materi_url).map(a => ({
      id: `assignment_materi:${a.id}`,
      name: a.materi_name || "soal",
      url: a.materi_url,
      kind: "assignment_materi" as const,
      label: a.title,
    })),
  ];
}

function meetingRows(meetings: Row[]) {
  return meetings.slice(0, 20).map(m => ({
    judul: m.title,
    waktu: m.time,
    sedang_berlangsung: m.status === "live" && !m.isEnded,
  }));
}

function eventRows(events: Row[]) {
  return events
    .filter(e => (e.event_date || "") >= today())
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
    .slice(0, 20)
    .map(e => ({ judul: e.title, tanggal: e.event_date, jam: e.event_time, jenis: e.event_type, lokasi: e.location }));
}

export async function buildAiData(user: AiUser): Promise<AiData> {
  return user.role === "teacher" ? buildTeacherData(user) : buildStudentData(user);
}

async function buildStudentData(user: AiUser): Promise<AiData> {
  const [users, classes, assignments, mySubs, myGrades, myAttendance, meetings, events] = await Promise.all([
    all("users"),
    all("classes"),
    all("assignments"),
    whereEq("assignment_submissions", "student_id", user.uid),
    whereEq("grades", "student_id", user.uid),
    whereEq("attendances", "student_id", user.uid),
    all("meetings"),
    all("calendar_events"),
  ]);

  const teacherName = (id?: string) => fullName(users.find(u => u.id === id));
  const className = (id?: string) => classes.find(c => c.id === id)?.name;
  const assignmentTitle = (id?: string) => assignments.find(a => a.id === id)?.title;

  const context = {
    profil_saya: { nama: user.name, kelas: user.classLevel || null },
    kelas: classes.sort(byDateDesc("created_at")).slice(0, MAX_ROWS).map(c => ({
      nama: c.name,
      mata_pelajaran: c.course_name,
      pengajar: teacherName(c.teacher_id),
      jadwal: c.schedule,
      ruang: c.room,
      deskripsi: c.description,
      file_materi: c.materi_name,
    })),
    tugas: assignments.sort(byDateDesc("due_date")).slice(0, MAX_ROWS).map(a => {
      const sub = mySubs.find(s => s.assignment_id === a.id);
      return {
        judul: a.title,
        mata_pelajaran: a.course_name,
        kelas: className(a.class_id),
        tenggat: a.due_date,
        deskripsi: a.description,
        file_soal: a.materi_name,
        status_saya: sub?.status || "belum dikerjakan",
        file_jawaban_saya: sub?.file_name,
      };
    }),
    nilai_saya: myGrades.sort(byDateDesc("created_at")).slice(0, MAX_ROWS).map(g => ({
      tugas: assignmentTitle(g.assignment_id),
      mata_pelajaran: g.course_name,
      nilai: g.score,
      huruf: g.grade_letter,
      feedback_guru: g.feedback,
      tanggal: g.created_at?.slice(0, 10),
    })),
    absensi_saya: summarizeAttendance(myAttendance, className),
    meeting: meetingRows(meetings.sort(byDateDesc("created_at"))),
    jadwal_mendatang: eventRows(events),
  };

  const files: ServerFileRef[] = [
    ...materiFiles(classes, assignments),
    ...mySubs.filter(s => s.file_url).map(s => ({
      id: `submission:${s.id}`,
      name: s.file_name || "jawaban",
      url: s.file_url,
      kind: "submission" as const,
      label: assignmentTitle(s.assignment_id) || "",
    })),
  ];

  return { context, files, submissions: [] };
}

async function buildTeacherData(user: AiUser): Promise<AiData> {
  const [users, allClasses, allAssignments, submissions, grades, attendances, meetings, events] = await Promise.all([
    all("users"),
    all("classes"),
    all("assignments"),
    all("assignment_submissions"),
    all("grades"),
    all("attendances"),
    all("meetings"),
    all("calendar_events"),
  ]);

  const classes = allClasses.filter(c => c.teacher_id === user.uid);
  const classIds = new Set(classes.map(c => c.id));
  const assignments = allAssignments.filter(a => a.teacher_id === user.uid || classIds.has(a.class_id));
  const assignmentIds = new Set(assignments.map(a => a.id));
  const mySubmissions = submissions.filter(s => assignmentIds.has(s.assignment_id));
  const myGrades = grades.filter(g => g.graded_by === user.uid || assignmentIds.has(g.assignment_id) || classIds.has(g.class_id));
  const students = users.filter(u => u.role_id === "1" || u.role === "student");

  const studentName = (id?: string) => fullName(users.find(u => u.id === id)) || "Siswa tidak dikenal";
  const className = (id?: string) => classes.find(c => c.id === id)?.name;
  const assignmentById = (id?: string) => assignments.find(a => a.id === id);
  const isGraded = (studentId: string, assignmentId: string) =>
    grades.some(g => g.student_id === studentId && g.assignment_id === assignmentId);

  const submitted = mySubmissions
    .filter(s => s.status === "submitted" || s.status === "graded")
    .sort(byDateDesc("submitted_at"))
    .map(s => {
      const a = assignmentById(s.assignment_id);
      return {
        submission_id: s.id,
        student_id: s.student_id,
        student_name: studentName(s.student_id),
        assignment_id: s.assignment_id,
        assignment_title: a?.title || "Tugas tidak dikenal",
        assignment_description: a?.description,
        assignment_materi_id: a?.materi_url ? `assignment_materi:${a.id}` : undefined,
        course_name: a?.course_name || "",
        class_id: a?.class_id,
        file_name: s.file_name || null,
        file_url: s.file_url || null,
        submitted_at: s.submitted_at || null,
        is_late: !!s.is_late,
        already_graded: isGraded(s.student_id, s.assignment_id),
      };
    });

  const context = {
    profil_saya: { nama: user.name, peran: "Pengajar" },
    kelas_saya: classes.sort(byDateDesc("created_at")).slice(0, MAX_ROWS).map(c => ({
      nama: c.name,
      mata_pelajaran: c.course_name,
      jadwal: c.schedule,
      ruang: c.room,
      deskripsi: c.description,
      file_materi: c.materi_name,
    })),
    tugas_saya: assignments.sort(byDateDesc("due_date")).slice(0, MAX_ROWS).map(a => {
      const subs = mySubmissions.filter(s => s.assignment_id === a.id);
      return {
        judul: a.title,
        mata_pelajaran: a.course_name,
        kelas: className(a.class_id),
        tenggat: a.due_date,
        deskripsi: a.description,
        file_soal: a.materi_name,
        jumlah_dikumpulkan: subs.filter(s => s.status === "submitted" || s.status === "graded").length,
        jumlah_sedang_dikerjakan: subs.filter(s => s.status === "started").length,
        jumlah_siswa: students.length,
      };
    }),
    tugas_dikumpulkan: submitted.slice(0, MAX_ROWS).map(s => ({
      siswa: s.student_name,
      tugas: s.assignment_title,
      mata_pelajaran: s.course_name,
      file: s.file_name,
      tanggal_kumpul: s.submitted_at?.slice(0, 10),
      terlambat: s.is_late,
      sudah_dinilai: s.already_graded,
    })),
    nilai_siswa: myGrades.sort(byDateDesc("created_at")).slice(0, MAX_ROWS * 2).map(g => ({
      siswa: studentName(g.student_id),
      tugas: assignmentById(g.assignment_id)?.title,
      mata_pelajaran: g.course_name,
      nilai: g.score,
      huruf: g.grade_letter,
      feedback: g.feedback,
    })),
    daftar_siswa: students.slice(0, MAX_ROWS * 2).map(u => ({ nama: fullName(u), kelas: u.class ?? null })),
    absensi_per_kelas: classes.map(c => ({
      ...summarizeAttendance(attendances.filter(a => a.class_id === c.id), className)[0],
      kelas: c.name,
    })),
    meeting_saya: meetingRows(meetings.filter(m => m.teacher_id === user.uid).sort(byDateDesc("created_at"))),
    jadwal_mendatang: eventRows(events.filter(e => e.created_by === user.uid || classIds.has(e.class_id))),
  };

  const files: ServerFileRef[] = [
    ...materiFiles(classes, assignments),
    ...submitted.filter(s => s.file_url).map(s => ({
      id: `submission:${s.submission_id}`,
      name: s.file_name || "jawaban",
      url: s.file_url!,
      kind: "submission" as const,
      label: `${s.student_name} · ${s.assignment_title}`,
    })),
  ];

  return { context, files, submissions: submitted };
}

// Hitung jumlah Hadir / Absen / Terlambat / Izin, dikelompokkan per kelas
function summarizeAttendance(rows: Row[], className: (id?: string) => string | undefined) {
  const groups = new Map<string, Row[]>();
  rows.forEach(r => groups.set(r.class_id, [...(groups.get(r.class_id) || []), r]));
  const result = [...groups.entries()].map(([classId, list]) => ({
    kelas: className(classId),
    hadir: list.filter(r => r.status === "Attended").length,
    terlambat: list.filter(r => r.status === "Late").length,
    absen: list.filter(r => r.status === "Absence").length,
    izin: list.filter(r => r.status === "ExcusedAbsen").length,
  }));
  return result.length ? result : [{ kelas: undefined, hadir: 0, terlambat: 0, absen: 0, izin: 0 }];
}

// Versi aman untuk dikirim ke browser (tanpa URL download)
export function publicFiles(files: ServerFileRef[]): AiFileRef[] {
  return files.map(({ id, name, kind, label }) => ({ id, name, kind, label }));
}
