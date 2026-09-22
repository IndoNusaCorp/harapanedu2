import { describe, it, expect } from "vitest";
import {
  gradeStats,
  normalize,
  searchDocuments,
  searchGrades,
  toScore,
  voiceToolDeclarations,
  type VoiceDocItem,
  type VoiceGradeItem,
} from "./voiceTools";

const FILES: VoiceDocItem[] = [
  { id: "class_materi:c1", name: "bab1-pecahan.pdf", label: "Matematika 4A", kind: "class_materi", url: "https://x/1" },
  { id: "assignment_materi:a1", name: "soal.docx", label: "PR Pecahan", kind: "assignment_materi", url: "https://x/2" },
  { id: "submission:s1", name: "ani.pdf", label: "Ani · PR Tumbuhan", kind: "submission", url: "https://x/3" },
];

const GRADES: VoiceGradeItem[] = [
  { student: "Ani Putri", assignment: "PR Pecahan", course: "Matematika", score: 90 },
  { student: "Budi", assignment: "PR Pecahan", course: "Matematika", score: 55 },
  { student: "Ani Putri", assignment: "PR Tumbuhan", course: "IPA", score: 80 },
  { student: "Citra", assignment: "PR Tumbuhan", course: "IPA", score: null },
];

describe("normalize", () => {
  it("lowercases and strips accents and punctuation", () => {
    expect(normalize("Café, Matematika-4A!")).toBe("cafe matematika 4a");
  });
});

describe("searchDocuments", () => {
  it("returns every file for an empty or stopword-only query", () => {
    expect(searchDocuments(FILES, "")).toHaveLength(3);
    expect(searchDocuments(FILES, "tolong tampilkan file saya")).toHaveLength(3);
  });

  it("matches on file name and label", () => {
    expect(searchDocuments(FILES, "pecahan").map(f => f.id)).toEqual(["class_materi:c1", "assignment_materi:a1"]);
    expect(searchDocuments(FILES, "matematika").map(f => f.id)).toEqual(["class_materi:c1"]);
  });

  it("matches on kind words", () => {
    expect(searchDocuments(FILES, "materi kelas").map(f => f.id)).toEqual(["class_materi:c1"]);
  });

  it("filters by kind", () => {
    expect(searchDocuments(FILES, "", "jawaban").map(f => f.id)).toEqual(["submission:s1"]);
  });

  it("falls back to partial matches when nothing matches every word", () => {
    expect(searchDocuments(FILES, "pecahan fisika").length).toBeGreaterThan(0);
    expect(searchDocuments(FILES, "sejarah")).toEqual([]);
  });
});

describe("searchGrades", () => {
  it("requires all words when possible", () => {
    expect(searchGrades(GRADES, "nilai Ani IPA")).toEqual([GRADES[2]]);
  });

  it("ignores filler words like 'nilai siswa'", () => {
    expect(searchGrades(GRADES, "nilai siswa saya")).toHaveLength(4);
  });
});

describe("gradeStats", () => {
  it("summarizes scored rows and skips unscored ones", () => {
    const stats = gradeStats(GRADES);
    expect(stats).toMatchObject({ count: 4, average: 75, highest: 90, lowest: 55, belowPassing: 1 });
    expect(stats.byCourse).toEqual([
      { course: "IPA", count: 1, average: 80 },
      { course: "Matematika", count: 2, average: 72.5 },
    ]);
  });

  it("handles no grades", () => {
    expect(gradeStats([])).toMatchObject({ count: 0, average: null, highest: null, lowest: null, byCourse: [] });
  });
});

describe("toScore", () => {
  it("parses numbers and rejects empty values", () => {
    expect(toScore("88")).toBe(88);
    expect(toScore(0)).toBe(0);
    expect(toScore("")).toBeNull();
    expect(toScore(undefined)).toBeNull();
    expect(toScore("abc")).toBeNull();
  });
});

describe("voiceToolDeclarations", () => {
  it("describes student grades as personal and teacher grades as students'", () => {
    const grades = (role: "teacher" | "student") =>
      voiceToolDeclarations(role).find(d => d.name === "show_grades")!.description;
    expect(grades("student")).toContain("nilai pribadi");
    expect(grades("teacher")).toContain("nilai siswa");
  });
});
