import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser, type AiUser } from "@/lib/ai/serverAuth";
import { buildAiData } from "@/lib/ai/dataContext";
import {
  PASSING_SCORE,
  gradeStats,
  searchDocuments,
  searchGrades,
  toScore,
  type VoiceGradeItem,
  type VoicePanel,
} from "@/lib/ai/voiceTools";

// Menjalankan tool yang dipanggil LibraAI Voice sebagai user yang login.
// Data diambil dari buildAiData, jadi siswa hanya melihat file & nilai miliknya,
// dan pengajar hanya melihat data kelas/tugasnya sendiri.

const MAX_DOCS = 30;
const MAX_GRADES_FOR_MODEL = 25;

type Row = Record<string, any>;

interface ToolResult {
  panel: VoicePanel;
  /** Ringkasan yang dikirim kembali ke Gemini untuk dijawab lewat suara */
  result: Record<string, unknown>;
}

async function showDocuments(user: AiUser, args: Row): Promise<ToolResult> {
  const { files } = await buildAiData(user);
  const query = String(args.query || "");
  const items = searchDocuments(files, query, args.kind).slice(0, MAX_DOCS);
  const openId = args.open && items.length > 0 ? items[0].id : null;

  return {
    panel: { type: "documents", query, items, openId },
    result: {
      jumlah_ditemukan: items.length,
      file: items.slice(0, 10).map(f => ({ nama: f.name, untuk: f.label })),
      dibuka: openId ? items[0].name : null,
      catatan: items.length
        ? "Daftar file sudah tampil di layar pengguna. Sebutkan singkat saja, jangan bacakan semuanya."
        : "Tidak ada file yang cocok. Beri tahu pengguna dan tawarkan kata kunci lain.",
    },
  };
}

async function showGrades(user: AiUser, args: Row): Promise<ToolResult> {
  const { context } = await buildAiData(user);
  const isTeacher = user.role === "teacher";
  const rows = ((isTeacher ? context.nilai_siswa : context.nilai_saya) || []) as Row[];

  const all: VoiceGradeItem[] = rows.map(r => ({
    student: isTeacher ? r.siswa : undefined,
    assignment: r.tugas || "-",
    course: r.mata_pelajaran || "",
    score: toScore(r.nilai),
    letter: r.huruf || undefined,
    feedback: (isTeacher ? r.feedback : r.feedback_guru) || undefined,
    date: r.tanggal || undefined,
  }));

  const query = String(args.query || "");
  const items = searchGrades(all, query);
  const stats = gradeStats(items);

  return {
    panel: { type: "grades", scope: isTeacher ? "teacher" : "student", query, items, stats },
    result: {
      jumlah: stats.count,
      rata_rata: stats.average,
      tertinggi: stats.highest,
      terendah: stats.lowest,
      [`di_bawah_${PASSING_SCORE}`]: stats.belowPassing,
      rata_rata_per_mapel: stats.byCourse,
      nilai: items.slice(0, MAX_GRADES_FOR_MODEL).map(g => ({
        ...(isTeacher ? { siswa: g.student } : {}),
        tugas: g.assignment,
        mapel: g.course,
        nilai: g.score,
      })),
      catatan: items.length
        ? "Daftar nilai sudah tampil di layar pengguna. Beri ringkasan singkat (misal rata-rata dan yang menonjol), jangan bacakan semua."
        : "Belum ada nilai yang cocok. Beri tahu pengguna.",
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyRequestUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Sesi login tidak valid." }, { status: 401 });
    }

    const { name, args } = await request.json().catch(() => ({}));
    const safeArgs: Row = args && typeof args === "object" ? args : {};

    if (name === "show_documents") {
      return NextResponse.json({ success: true, data: await showDocuments(user, safeArgs) });
    }
    if (name === "show_grades") {
      return NextResponse.json({ success: true, data: await showGrades(user, safeArgs) });
    }
    return NextResponse.json({ success: false, error: "Tool tidak dikenal." }, { status: 400 });
  } catch (error) {
    console.error("Voice tool error:", error);
    return NextResponse.json({ success: false, error: "Gagal menjalankan tool." }, { status: 500 });
  }
}
