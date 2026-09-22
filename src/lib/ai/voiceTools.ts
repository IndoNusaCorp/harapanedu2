import type { AiFileRef } from "@/lib/types";

// ============================================
// Tools untuk LibraAI Voice (Gemini Live function calling)
// ============================================
// Model memanggil tool → browser meminta data ke /api/libraai-voice/tools → hasilnya
// ditampilkan sebagai panel di bola LibraAI dan diringkas kembali ke model untuk dijawab lewat suara.
// File ini tanpa dependensi server supaya bisa dipakai di browser maupun di API route.

export type VoiceToolName = "show_documents" | "show_grades" | "close_panel";

export const VOICE_TOOL_NAMES: VoiceToolName[] = ["show_documents", "show_grades", "close_panel"];

export const PASSING_SCORE = 70;

export type DocKindFilter = "materi_kelas" | "soal_tugas" | "jawaban";

const KIND_FILTER: Record<DocKindFilter, AiFileRef["kind"]> = {
  materi_kelas: "class_materi",
  soal_tugas: "assignment_materi",
  jawaban: "submission",
};

export interface VoiceDocItem extends AiFileRef {
  url: string;
}

export interface VoiceGradeItem {
  student?: string;
  assignment: string;
  course: string;
  score: number | null;
  letter?: string;
  feedback?: string;
  date?: string;
}

export interface GradeStats {
  count: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  belowPassing: number;
  /** Rata-rata per mata pelajaran, urut dari yang tertinggi */
  byCourse: { course: string; average: number; count: number }[];
}

export type VoicePanel =
  | { type: "loading"; tool: VoiceToolName }
  | { type: "documents"; query: string; items: VoiceDocItem[]; openId: string | null }
  | { type: "grades"; scope: "student" | "teacher"; query: string; items: VoiceGradeItem[]; stats: GradeStats }
  | { type: "error"; tool: VoiceToolName };

/** Deklarasi tool untuk Gemini Live (dikirim sebagai JSON, jadi tipe ditulis sebagai string) */
export function voiceToolDeclarations(role: "teacher" | "student") {
  const isTeacher = role === "teacher";
  return [
    {
      name: "show_documents",
      description:
        "Menampilkan file dokumen HarapanEdu di layar pengguna (materi kelas, file soal tugas, " +
        (isTeacher ? "dan file jawaban siswa" : "dan file jawaban milik pengguna") +
        "). Panggil saat pengguna minta melihat, membuka, mencari, atau menampilkan file/dokumen/materi.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: {
            type: "STRING",
            description: "Kata kunci singkat dari permintaan pengguna, misal nama mata pelajaran, judul tugas, atau nama file. Kosongkan untuk menampilkan semua file.",
          },
          kind: {
            type: "STRING",
            enum: ["materi_kelas", "soal_tugas", "jawaban"],
            description: "Opsional: jenis file jika pengguna menyebutkannya.",
          },
          open: {
            type: "BOOLEAN",
            description: "true jika pengguna ingin langsung MEMBUKA satu file tertentu (bukan hanya melihat daftar).",
          },
        },
      },
    },
    {
      name: "show_grades",
      description: isTeacher
        ? "Menampilkan daftar nilai siswa di kelas/tugas milik pengajar di layar. Panggil saat pengajar minta melihat nilai siswa, nilai suatu tugas, atau nilai siswa tertentu."
        : "Menampilkan daftar nilai pribadi pengguna di layar. Panggil saat pengguna minta melihat nilainya.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: {
            type: "STRING",
            description: isTeacher
              ? "Opsional: kata kunci nama siswa, judul tugas, atau mata pelajaran. Kosongkan untuk semua nilai."
              : "Opsional: kata kunci judul tugas atau mata pelajaran. Kosongkan untuk semua nilai.",
          },
        },
      },
    },
    {
      name: "close_panel",
      description: "Menutup panel/dokumen yang sedang ditampilkan di layar. Panggil saat pengguna minta menutup atau menyembunyikannya.",
    },
  ];
}

// ---------- Pencarian ----------

const STOPWORDS = new Set([
  "file", "files", "dokumen", "document", "documents", "yang", "dan", "di", "ke", "dari", "saya", "aku", "ku",
  "tolong", "buka", "bukakan", "tampilkan", "lihat", "cari", "carikan", "untuk", "the", "of", "my", "show", "open",
  "nilai", "grade", "grades", "semua", "all", "dong", "ya", "mata", "pelajaran", "mapel",
  "siswa", "murid", "student", "students",
]);

// Kata yang ikut dicari untuk tiap jenis file, supaya "materi kelas" / "soal tugas" tetap cocok
const KIND_WORDS: Record<AiFileRef["kind"], string> = {
  class_materi: "materi kelas class material",
  assignment_materi: "soal tugas assignment",
  submission: "jawaban pengumpulan answer submission",
};

export function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(query: string): string[] {
  return normalize(query).split(" ").filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Cari item berdasarkan kata kunci. Utamakan item yang cocok dengan SEMUA kata kunci;
 * jika tidak ada, pakai item yang cocok dengan sebagian besar kata kunci.
 */
export function searchItems<T>(items: T[], query: string, text: (item: T) => string): T[] {
  const words = tokens(query);
  if (words.length === 0) return items;

  const scored = items
    .map(item => {
      const hay = normalize(text(item));
      return { item, score: words.filter(w => hay.includes(w)).length / words.length };
    })
    .filter(s => s.score > 0);

  const exact = scored.filter(s => s.score === 1);
  if (exact.length) return exact.map(s => s.item);
  return scored.filter(s => s.score >= 0.5).sort((a, b) => b.score - a.score).map(s => s.item);
}

export function searchDocuments(files: VoiceDocItem[], query: string, kind?: string): VoiceDocItem[] {
  const kindFilter = KIND_FILTER[kind as DocKindFilter];
  const pool = kindFilter ? files.filter(f => f.kind === kindFilter) : files;
  return searchItems(pool, query, f => `${f.name} ${f.label} ${KIND_WORDS[f.kind] || ""}`);
}

export function searchGrades(items: VoiceGradeItem[], query: string): VoiceGradeItem[] {
  return searchItems(items, query, g => `${g.student || ""} ${g.assignment} ${g.course}`);
}

// ---------- Statistik nilai ----------

const round1 = (n: number) => Math.round(n * 10) / 10;

export function gradeStats(items: VoiceGradeItem[]): GradeStats {
  const scores = items.map(i => i.score).filter((s): s is number => s !== null);
  const courses = new Map<string, number[]>();
  items.forEach(i => {
    if (i.score === null) return;
    const key = i.course || "-";
    courses.set(key, [...(courses.get(key) || []), i.score]);
  });

  return {
    count: items.length,
    average: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    highest: scores.length ? Math.max(...scores) : null,
    lowest: scores.length ? Math.min(...scores) : null,
    belowPassing: scores.filter(s => s < PASSING_SCORE).length,
    byCourse: [...courses.entries()]
      .map(([course, list]) => ({ course, count: list.length, average: round1(list.reduce((a, b) => a + b, 0) / list.length) }))
      .sort((a, b) => b.average - a.average),
  };
}

export function toScore(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return value === null || value === undefined || value === "" || Number.isNaN(n) ? null : n;
}

export function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}
