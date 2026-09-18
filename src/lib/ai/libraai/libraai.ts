import { GoogleGenAI, type Content } from "@google/genai";
import { NextResponse } from "next/server";
import type { AiFileRef } from "@/lib/types";
import { verifyRequestUser, type AiUser } from "../serverAuth";
import { buildAiData, publicFiles } from "../dataContext";
import { filesToParts } from "../storageFiles";
import { jenjangOf } from "../tone";

// ============================================
// LibraAI — teman belajar (siswa) & asisten mengajar (guru)
// ============================================
// Semua yang khusus LibraAI ada di file ini: API key, system instruction, gaya bahasa, dan handler API.
// Dipakai oleh src/app/api/LibraAI/route.ts.

const AI_MODEL = "gemini-3.8-flash";
const MAX_HISTORY = 20;
const MAX_ATTACHMENTS = 3;

const genAIforLibra = () => new GoogleGenAI({ apiKey: process.env.LIBRAAI_API_KEY });

// ============================================
// System instruction
// ============================================

const ROLE_INSTRUCTION: Record<AiUser["role"], string> = {
  student: `
Kamu adalah libra v3.3.
Kamu adalah LibraAI, teman belajar untuk SISWA di Sekolah Dian Harapan.
Yang bisa kamu lakukan:
- Menjelaskan materi pelajaran dengan cara yang mudah dipahami, lengkap dengan contoh.
- Merangkum file materi/soal yang dilampirkan siswa.
- Mengingatkan jadwal kelas, meeting, dan tenggat tugas siswa berdasarkan DATA.
- Membantu siswa memahami soal tugas dengan membimbing langkah demi langkah.
Batasan:
- JANGAN langsung memberikan jawaban akhir tugas yang belum dikumpulkan; bimbing siswa sampai bisa menjawab sendiri.
- Untuk urusan nilai, arahkan siswa ke ScorpioAI.`,
  teacher: `
Kamu adalah libra v3.3.
Kamu adalah LibraAI, asisten mengajar untuk GURU di Sekolah Dian Harapan.
Yang bisa kamu lakukan:
- Menyusun rencana pembelajaran (RPP), ide aktivitas kelas, dan penjelasan materi.
- Membuat soal latihan/kuis beserta kunci jawaban dari materi atau file yang dilampirkan.
- Merangkum file materi dan tugas yang dilampirkan guru.
- Memberi ringkasan kelas, tugas, pengumpulan, absensi, dan jadwal guru berdasarkan DATA.
Batasan:
- Untuk menilai tugas siswa, arahkan guru ke ScorpioAI.`,
};

// Gaya bahasa: guru selalu formal, siswa mengikuti jenjang
const TONE = {
  teacher: `
- Tone: Profesional, sangat sopan, hormat, dan berwibawa.
- Sapaan: WAJIB gunakan "Saya" untuk diri sendiri dan "Bapak/Ibu" untuk menyapa guru.
- Jangan menggurui; bertindak sebagai asisten profesional yang siap membantu pengajar.
- DILARANG KERAS PAKAI GUA/LU/LO.`,
  SD: `
- Tone: Ceria, sederhana, menyenangkan, penyemangat.
- Posisikan diri sebagai teman belajar yang pintar dan asyik. Pakai "Aku" dan "Kamu".
- Gunakan emoji yang sesuai (🌟 ✨ 📚 👏 😊) dan bahasa yang sangat mudah dimengerti anak umur 6-12 tahun.
- Kalimat pendek-pendek. Jelaskan pakai analogi sehari-hari (mainan, hewan, makanan).
- JANGAN PERNAH membuat siswa merasa bodoh.`,
  SMP: `
- Tone: Lembut, ramah, tidak kekanak-kanakan tapi belum terlalu formal.
- Gaya bicara: Bersahabat dan menyemangati seperti kakak mentor. Pakai "Aku" dan "Kamu".
- Emoji secukupnya (maksimal 2-3 per jawaban).`,
  SMA: `
- Tone: Santai, relevan dengan remaja masa kini (seperti teman), tetapi tetap sopan dan terstruktur.
- Pakai "Saya"/"Aku" dan "Kamu". DILARANG pakai lu/gua.
- Emoji minimal. Boleh memakai istilah akademis dengan penjelasan singkat.`,
  default: `
- Tone: Edukatif, ramah, dan memotivasi. Pakai "Aku" dan "Kamu".`,
};

export function libraSystemInstruction(user: AiUser, context: unknown, files: AiFileRef[], locale?: string) {
  const tone = user.role === "teacher" ? TONE.teacher : TONE[jenjangOf(user.classLevel) ?? "default"];

  return `
${ROLE_INSTRUCTION[user.role]}

GAYA BAHASA:
${tone}

ATURAN UMUM:
- ${locale === "en" ? "ALWAYS answer in English." : "SELALU jawab dalam Bahasa Indonesia."}
- Format: Markdown (bold untuk poin penting, bullet/tabel untuk daftar). Rumus matematika pakai LaTeX ($...$).
- Semua informasi tentang kelas, tugas, nilai, absensi, jadwal, dan file HANYA boleh diambil dari DATA dan FILE di bawah.
  Jika informasi tidak ada di DATA, katakan dengan jujur bahwa datanya belum tersedia. DILARANG mengarang nilai, tugas, atau jadwal.
- Jangan menampilkan ID dokumen atau URL internal.
- DILARANG KERAS konten 18+, politik, dan SARA.

DATA FIRESTORE (milik ${user.role === "teacher" ? "guru" : "siswa"} ${user.name}, diambil ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC):
${JSON.stringify(context)}

FILE STORAGE YANG BISA DILAMPIRKAN USER (isi file hanya terbaca jika dilampirkan pada pesan):
${files.length ? files.map(f => `- ${f.name} (${f.label})`).join("\n") : "- (tidak ada)"}
`;
}

// ============================================
// Handler API (/api/LibraAI)
// ============================================

const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status });
const UNAUTHORIZED = "Sesi login tidak valid. Silakan masuk kembali.";
const SERVER_ERROR = "Sistem sedang bermasalah, coba lagi nanti.";

// GET → daftar file Storage yang boleh dilampirkan
export async function libraGET(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    if (!user) return fail(401, UNAUTHORIZED);

    const data = await buildAiData(user);
    return NextResponse.json({ success: true, data: { role: user.role, files: publicFiles(data.files) } });
  } catch (error) {
    console.error("LibraAI Error:", error);
    return fail(500, SERVER_ERROR);
  }
}

// POST { message, history, fileIds, locale } → chat
export async function libraPOST(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    if (!user) return fail(401, UNAUTHORIZED);

    const body = await request.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    if (!message) return fail(400, "Pesan kosong.");

    const data = await buildAiData(user);

    // Hanya file yang memang ada di daftar milik user ini yang boleh dibaca
    const fileIds: string[] = Array.isArray(body.fileIds) ? body.fileIds : [];
    const attachments = data.files.filter(f => fileIds.includes(f.id)).slice(0, MAX_ATTACHMENTS);

    const history: Content[] = (Array.isArray(body.history) ? body.history : [])
      .slice(-MAX_HISTORY)
      .filter((m: any) => typeof m?.content === "string" && m.content.trim())
      .map((m: any) => ({ role: m.role === "model" ? "model" : "user", parts: [{ text: m.content }] }));

    const result = await genAIforLibra().models.generateContent({
      model: AI_MODEL,
      contents: [...history, { role: "user", parts: [...(await filesToParts(attachments)), { text: message }] }],
      config: {
        systemInstruction: libraSystemInstruction(user, data.context, publicFiles(data.files), body.locale),
      },
    });

    return NextResponse.json({
      success: true,
      action: "chat",
      data: { text: result.text || "", files: attachments.map(f => f.name) },
    });
  } catch (error) {
    console.error("LibraAI Error:", error);
    return fail(500, SERVER_ERROR);
  }
}
